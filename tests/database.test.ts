import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { parseImport } from "../src/lib/import";
import { titleSchema } from "../src/lib/model";
import seed from "../src/lib/v1-seed.json";
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222";
let db: PGlite;
async function asUser(uid: string, sql: string, params: unknown[] = []) {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);`,
  );
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}
async function imported(uid: string, payload: unknown) {
  return asUser(uid, "select public.import_library($1::jsonb) result", [
    JSON.stringify(payload),
  ]);
}
const migration = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(`supabase/migrations/${f}`, "utf8"))
  .join("\n");
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values('${A}'),('${B}');`,
  );
  await db.exec(migration);
});
afterAll(async () => {
  await db.close();
});
describe("PostgreSQL persistence and ownership", () => {
  it("enables RLS on all eight user tables", async () => {
    const r = await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'",
    );
    expect(r.rows).toHaveLength(8);
    expect(r.rows.every((r) => r.relrowsecurity)).toBe(true);
  });
  it("imports transactionally and deduplicates without overwriting", async () => {
    const first = await imported(A, parseImport(seed, true));
    expect(first.rows[0]).toEqual({ result: { added: 44, skipped: 0 } });
    const again = await imported(A, parseImport(seed, true));
    expect(again.rows[0]).toEqual({ result: { added: 0, skipped: 44 } });
  });
  it("denies anon access to the catalog and RPCs", async () => {
    await db.exec("set role anon");
    try {
      await expect(db.query("select * from public.titles")).rejects.toThrow(
        /permission denied/,
      );
      await expect(db.query("select public.export_library()")).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      await db.exec("reset role");
    }
  });
  it("prevents user B from reading or changing A’s records", async () => {
    for (const table of [
      "titles",
      "watch_entries",
      "seasons",
      "review_snapshots",
      "availability",
      "recommendations",
      "taste_signals",
      "profiles",
    ]) {
      const r = await asUser(B, `select * from public.${table}`);
      expect(r.rows).toHaveLength(0);
    }
    const r = await asUser(
      B,
      "update public.watch_entries set notes='intrusion' returning title_id",
    );
    expect(r.rows).toHaveLength(0);
  });
  it("rejects cross-owner insert, ownership reassignment, and foreign relations", async () => {
    await expect(
      asUser(
        B,
        `insert into public.titles(user_id,title,media_type) values('${A}','Intrusion','movie')`,
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asUser(A, `update public.titles set user_id='${B}'`),
    ).rejects.toThrow();
    const title = await db.query<{ id: string }>(
      "select id from public.titles limit 1",
    );
    await expect(
      asUser(B, "insert into public.watch_entries(title_id) values($1)", [
        title.rows[0].id,
      ]),
    ).rejects.toThrow(/foreign key/);
  });
  it("persists watch and season updates independently", async () => {
    const r = await asUser(
      A,
      "select id from public.titles where title='Reacher'",
    );
    const id = (r.rows[0] as { id: string }).id;
    await asUser(
      A,
      "update public.watch_entries set status='watching',rating=8.5,notes='Keep my notes' where title_id=$1",
      [id],
    );
    await asUser(
      A,
      "update public.seasons set status='watching',notes='Started S4' where title_id=$1 and number=4",
      [id],
    );
    const seasons = await asUser(
      A,
      "select number,status from public.seasons where title_id=$1 order by number",
      [id],
    );
    expect(seasons.rows.map((s) => (s as { status: string }).status)).toEqual([
      "watched",
      "watched",
      "watched",
      "watching",
    ]);
    await imported(A, parseImport(seed, true));
    const watch = await asUser(
      A,
      "select rating,notes from public.watch_entries where title_id=$1",
      [id],
    );
    expect(watch.rows[0]).toEqual({ rating: "8.5", notes: "Keep my notes" });
  });
  it("rolls back the whole import if a later title fails", async () => {
    const valid = titleSchema.parse({
      title: "Transaction sentinel",
      media_type: "movie",
    });
    const bad = {
      ...titleSchema.parse({ title: "Invalid movie", media_type: "movie" }),
      seasons: [{ number: 1, status: "watched" }],
    };
    await expect(
      imported(A, { version: 2, titles: [valid, bad], taste: [] }),
    ).rejects.toThrow(/Movies cannot/);
    const r = await asUser(
      A,
      "select id from public.titles where title='Transaction sentinel'",
    );
    expect(r.rows).toHaveLength(0);
  });
  it("queries filters and pagination at the database", async () => {
    const r = await asUser(A, "select public.library_page($1) result", [
      JSON.stringify({
        q: "reacher",
        status: "watching",
        type: "series",
        platform: "Prime",
        rating: "8",
        limit: 1,
      }),
    ]);
    const result = (
      r.rows[0] as { result: { total: number; titles: unknown[] } }
    ).result;
    expect(result.total).toBe(1);
    expect(result.titles).toHaveLength(1);
    const empty = await asUser(B, "select public.library_page() result");
    expect(empty.rows[0]).toEqual({ result: { total: 0, titles: [] } });
  });
  it("keeps recommendations, taste and profile isolated and exports owned data", async () => {
    const t = titleSchema.parse({
      title: "User B film",
      media_type: "movie",
      recommendation: {
        recommended_on: "2026-10-10",
        reason: "A clever mystery",
      },
    });
    await imported(B, {
      version: 2,
      titles: [t],
      taste: [{ signal: "action", weight: -2, notes: "Less please" }],
      profile: { display_name: "B", region: "JP" },
    });
    const r = await asUser(B, "select public.export_library() result");
    const data = (
      r.rows[0] as { result: { titles: unknown[]; taste: unknown[] } }
    ).result;
    expect(data.titles).toHaveLength(1);
    expect(data.taste).toHaveLength(1);
    expect(
      parseImport((r.rows[0] as { result: unknown }).result).titles[0]
        .recommendation?.reason,
    ).toBe("A clever mystery");
  });
});

it("orders paginated title queries deterministically", async () => {
  const first = await asUser(A, "select public.library_page($1) result", [
    JSON.stringify({ sort: "title", limit: 5 }),
  ]);
  const second = await asUser(A, "select public.library_page($1) result", [
    JSON.stringify({ sort: "title", limit: 5, offset: 5 }),
  ]);
  const a = (
    first.rows[0] as { result: { titles: { id: string; title: string }[] } }
  ).result.titles;
  const b = (
    second.rows[0] as { result: { titles: { id: string; title: string }[] } }
  ).result.titles;
  expect(new Set([...a, ...b].map((t) => t.id)).size).toBe(10);
  expect(a.map((t) => t.title)).toEqual([...a.map((t) => t.title)].sort());
});
it("upcoming releases require sourced verification, preferred region and future events", async () => {
  const r = await asUser(
    A,
    "select id from public.titles where title='Reacher'",
  );
  const id = (r.rows[0] as { id: string }).id;
  await asUser(
    A,
    "insert into public.availability(title_id,region,provider,kind,release_on,ott_on,verified_on,source_url) values($1,'JP','Test provider','subscription','2026-01-01','2026-12-01','2026-10-10','https://example.com/evidence'),($1,'US','US provider','subscription','2026-11-01',null,'2026-10-10','https://example.com/us'),($1,'JP','Unverified','unknown','2026-11-01',null,null,null)",
    [id],
  );
  const future = await asUser(
    A,
    "select * from public.upcoming_releases('JP','2026-10-10')",
  );
  expect(future.rows).toHaveLength(1);
  expect(future.rows[0]).toMatchObject({
    provider: "Test provider",
    region: "JP",
    event_type: "OTT",
    event_date: new Date("2026-12-01T00:00:00Z"),
  });
  const foreign = await asUser(
    B,
    "select * from public.upcoming_releases('JP','2026-10-10')",
  );
  expect(foreign.rows).toHaveLength(0);
});
