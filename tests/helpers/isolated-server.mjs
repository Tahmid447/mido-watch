// Isolated test-only Supabase HTTP contract backed by real PostgreSQL/RLS via PGlite.
// Never imported by the app; never deployed; never connects to a hosted project.
import http from "node:http";
import { spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { createHmac, timingSafeEqual } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
const users = JSON.parse(readFileSync(".env.test-users.json", "utf8"));
const db = new PGlite();
await db.exec(
  `create role anon; create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
);
for (const u of users)
  await db.query("insert into auth.users values($1)", [u.id]);
for (const file of readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort())
  await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
const tableNames = [
  "titles",
  "watch_entries",
  "seasons",
  "review_snapshots",
  "availability",
  "recommendations",
  "taste_signals",
  "profiles",
  "plan_items",
];
const types = new Map();
const columns = new Map(),
  pks = new Map();
for (const table of tableNames) {
  const c = await db.query(
    "select column_name,data_type from information_schema.columns where table_schema='public' and table_name=$1",
    [table],
  );
  types.set(table, new Map(c.rows.map((r) => [r.column_name, r.data_type])));
  columns.set(table, new Set(c.rows.map((r) => r.column_name)));
  const pk = await db.query(
    "select a.attname as name from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey) where i.indrelid=$1::regclass and i.indisprimary",
    [`public.${table}`],
  );
  pks.set(
    table,
    pk.rows.map((r) => r.name),
  );
}
const secret = "isolated-contract-signing-key-never-used-outside-tests";
const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function token(u) {
  const body = `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: u.id, role: "authenticated", aud: "authenticated", iss: "http://127.0.0.1:54329/auth/v1", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })}`;
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}
function identity(req) {
  try {
    const raw = req.headers.authorization?.replace(/^Bearer /, "") ?? "";
    const parts = raw.split(".");
    if (parts.length !== 3) return null;
    const sig = createHmac("sha256", secret)
      .update(parts.slice(0, 2).join("."))
      .digest();
    const received = Buffer.from(parts[2], "base64url");
    if (sig.length !== received.length || !timingSafeEqual(sig, received))
      return null;
    return (
      users.find(
        (u) => u.id === JSON.parse(Buffer.from(parts[1], "base64url")).sub,
      ) ?? null
    );
  } catch {
    return null;
  }
}
const userDoc = (u) => ({
  id: u.id,
  email: u.email,
  aud: "authenticated",
  role: "authenticated",
  is_anonymous: false,
  email_confirmed_at: "2026-01-01T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  identities: [],
});
const rpc = {
  export_library: [],
  library_page: ["filters"],
  import_library: ["payload"],
  upcoming_releases: ["p_region", "p_today"],
  apply_title_metadata: ["p_title_id", "payload"],
  import_recommendation_pack: ["payload", "p_pack_hash"],
  act_on_recommendation: ["p_title_id", "p_action"],
  audit_status: ["p_title_id", "p_status", "p_season", "p_expected"],
  edit_plan: [
    "p_action",
    "p_item_id",
    "p_title_id",
    "p_season_number",
    "p_week",
    "p_expected",
    "p_journal_expected",
    "p_label",
  ],
};
let queue = Promise.resolve();
async function request(req, res) {
  let body = "";
  for await (const c of req) {
    body += c;
    if (body.length > 4_500_000) throw Error("Request too large");
  }
  const data = body ? JSON.parse(body) : {};
  const url = new URL(req.url, "http://127.0.0.1:54329");
  const send = (status, value) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(value === undefined ? "" : JSON.stringify(value));
  };
  if (url.pathname === "/auth/v1/token") {
    const u =
      data.grant_type === "refresh_token"
        ? users.find((u) => u.id === data.refresh_token)
        : users.find(
            (u) => u.email === data.email && u.password === data.password,
          );
    if (!u)
      return send(400, {
        error: "invalid_grant",
        error_description: "Invalid login credentials",
      });
    return send(200, {
      access_token: token(u),
      refresh_token: u.id,
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: "bearer",
      user: userDoc(u),
    });
  }
  const u = identity(req);
  if (url.pathname === "/auth/v1/user")
    return send(u ? 200 : 401, u ? userDoc(u) : { message: "Unauthorized" });
  if (url.pathname === "/auth/v1/logout") return send(204);
  if (!u)
    return send(401, { code: "42501", message: "Authentication required" });
  await db.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${u.id}',false);`,
  );
  try {
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const name = url.pathname.split("/").at(-1);
      if (!(name in rpc)) return send(404, { message: "Unknown RPC" });
      const names = rpc[name].filter((k) => data[k] !== undefined),
        args = names.map((k) =>
          data[k] !== null && typeof data[k] === "object"
            ? JSON.stringify(data[k])
            : data[k],
        );
      const call = names.map((k, i) => `${k} => $${i + 1}`).join(",");
      const q = await db.query(`select public.${name}(${call}) as value`, args);
      return send(
        200,
        name === "upcoming_releases"
          ? q.rows.map((r) => r.value)
          : (q.rows[0]?.value ?? null),
      );
    }
    const table = url.pathname.split("/").at(-1);
    if (!columns.has(table)) return send(404, { message: "Unknown table" });
    const safe = (name) => {
      if (!columns.get(table).has(name)) throw Error("Unknown column");
      return `"${name}"`;
    };
    const args = [],
      conditions = [];
    for (const [key, filter] of url.searchParams) {
      if (!columns.get(table).has(key)) continue;
      const dot = filter.indexOf("."),
        op = filter.slice(0, dot),
        val = filter.slice(dot + 1);
      if (!["eq", "neq", "gt", "gte", "lt", "lte", "is"].includes(op))
        throw Error("Unsupported filter");
      if (op === "is" && val === "null")
        conditions.push(`${safe(key)} is null`);
      else {
        args.push(val);
        conditions.push(
          `${safe(key)} ${{ eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" }[op]} $${args.length}`,
        );
      }
    }
    const where = conditions.length ? " where " + conditions.join(" and ") : "";
    let rows = [];
    if (req.method === "GET") {
      const order = (url.searchParams.get("order") ?? "")
        .split(",")
        .filter(Boolean)
        .map((s) => {
          const [key, direction] = s.split(".");
          return `${safe(key)} ${direction === "desc" ? "desc" : "asc"}`;
        });
      const limit = Number(url.searchParams.get("limit") ?? 10000);
      const q = await db.query(
        `select * from public.${table}${where}${order.length ? " order by " + order.join(",") : ""} limit ${Math.min(Math.max(limit, 1), 10000)}`,
        args,
      );
      rows = q.rows;
      if (
        table === "titles" &&
        url.searchParams.get("select")?.includes("watch_entries(")
      ) {
        rows = [];
        for (const t of q.rows) {
          const doc = await db.query(
            "select public.title_document(t) as d from public.titles t where id=$1",
            [t.id],
          );
          const d = doc.rows[0].d;
          rows.push({
            ...t,
            watch_entries: d.watch,
            seasons: d.seasons,
            review_snapshots: d.reviews,
            availability: d.availability,
            recommendations: d.recommendation,
          });
        }
      }
    } else if (req.method === "POST") {
      for (const row of Array.isArray(data) ? data : [data]) {
        const keys = Object.keys(row),
          values = keys.map((k) =>
            row[k] !== null &&
            typeof row[k] === "object" &&
            !Array.isArray(row[k])
              ? JSON.stringify(row[k])
              : row[k],
          );
        const resolution = req.headers.prefer ?? "";
        let conflict = "";
        if (resolution.includes("resolution=ignore-duplicates"))
          conflict = " on conflict do nothing";
        else if (resolution.includes("resolution=merge-duplicates")) {
          const pk = (
            url.searchParams.get("on_conflict") ?? pks.get(table).join(",")
          ).split(",");
          conflict = ` on conflict (${pk.map(safe).join(",")}) do update set ${keys
            .filter((k) => !pk.includes(k))
            .map((k) => `${safe(k)}=excluded.${safe(k)}`)
            .join(",")}`;
        }
        rows.push(
          ...(
            await db.query(
              `insert into public.${table}(${keys.map(safe).join(",")}) values(${values.map((_, i) => "$" + (i + 1)).join(",")})${conflict} returning *`,
              values,
            )
          ).rows,
        );
      }
    } else if (req.method === "PATCH") {
      const keys = Object.keys(data);
      const values = keys.map((k) =>
        data[k] !== null &&
        typeof data[k] === "object" &&
        !Array.isArray(data[k])
          ? JSON.stringify(data[k])
          : data[k],
      );
      rows = (
        await db.query(
          `update public.${table} set ${keys.map((k, i) => `${safe(k)}=$${args.length + i + 1}`).join(",")}${where} returning *`,
          [...args, ...values],
        )
      ).rows;
    } else if (req.method === "DELETE")
      rows = (
        await db.query(`delete from public.${table}${where} returning *`, args)
      ).rows;
    rows = rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key,
          types.get(table)?.get(key) === "numeric" && value !== null
            ? Number(value)
            : types.get(table)?.get(key) === "date" && value instanceof Date
              ? value.toISOString().slice(0, 10)
              : value,
        ]),
      ),
    );
    const object = req.headers.accept?.includes(
      "application/vnd.pgrst.object+json",
    );
    if (object) {
      if (rows.length !== 1)
        return send(406, {
          code: "PGRST116",
          message: "JSON object requested, multiple (or no) rows returned",
          details: `The result contains ${rows.length} rows`,
        });
      return send(200, rows[0]);
    }
    return send(req.method === "POST" ? 201 : 200, rows);
  } finally {
    await db.exec("reset role");
  }
}
const server = http.createServer((req, res) => {
  const next = queue
    .then(() => request(req, res))
    .catch((e) => {
      if (!res.headersSent) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            message: e.message,
            code: e.code ?? "CONTRACT_ERROR",
          }),
        );
      }
    });
  queue = next;
});
await new Promise((resolve) => server.listen(54329, "127.0.0.1", resolve));
const app = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3100",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        "sb_publishable_isolated_contract_only",
      TMDB_API_KEY: "",
      TMDB_READ_ACCESS_TOKEN: "",
    },
  },
);
async function close() {
  app.kill("SIGTERM");
  server.close();
  await db.close();
  process.exit(0);
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
app.on("exit", (code) => {
  server.close();
  process.exit(code ?? 1);
});
