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

describe("V2.1 private enrichment and Friday packs", () => {
  it("refreshes metadata while preserving journals, ranked seasons and manual evidence", async () => {
    const t = (
      await asUser(A, "select id from public.titles where title='Reacher'")
    ).rows[0] as { id: string };
    const before = (
      await asUser(
        A,
        "select to_jsonb(w) as journal from public.watch_entries w where title_id=$1",
        [t.id],
      )
    ).rows;
    const seasons = (
      await asUser(
        A,
        "select number,status,rating,notes,rank from public.seasons where title_id=$1 order by number",
        [t.id],
      )
    ).rows;
    await asUser(
      A,
      "insert into public.availability(title_id,region,provider,kind,source_url,verified_on) values($1,'JP','Manual subscription','subscription','https://example.com','2026-10-10')",
      [t.id],
    );
    const payload = {
      metadata: {
        state: "matched",
        refreshed_at: "2026-10-10T12:00:00Z",
        poster_path: "/example.jpg",
        season_info: [{ number: 1 }, { number: 5 }],
      },
      tmdb_id: 108978,
      region: "JP",
      reviews: [
        {
          source: "TMDb",
          score: "8/10",
          score_type: "10-point",
          vote_count: 100,
          captured_on: "2026-10-10",
          source_url: "https://www.themoviedb.org/tv/108978",
          evidence_key: "tmdb:rating",
        },
      ],
      availability: [
        {
          region: "JP",
          provider: "Provider fixture",
          kind: "rent",
          source_url: "https://www.themoviedb.org/tv/108978/watch",
          evidence_key: "tmdb:JP:1:rent",
          fetched_at: "2026-10-10T12:00:00Z",
        },
      ],
    };
    await asUser(A, "select public.apply_title_metadata($1,$2::jsonb)", [
      t.id,
      JSON.stringify(payload),
    ]);
    await asUser(A, "select public.apply_title_metadata($1,$2::jsonb)", [
      t.id,
      JSON.stringify(payload),
    ]);
    expect(
      (
        await asUser(
          A,
          "select to_jsonb(w) as journal from public.watch_entries w where title_id=$1",
          [t.id],
        )
      ).rows,
    ).toEqual(before);
    expect(
      (
        await asUser(
          A,
          "select number,status,rating,notes,rank from public.seasons where title_id=$1 and number<=4 order by number",
          [t.id],
        )
      ).rows,
    ).toEqual(seasons);
    expect(
      (
        await asUser(
          A,
          "select provider,origin from public.availability where title_id=$1 and provider in ('Manual subscription','Provider fixture') order by provider",
          [t.id],
        )
      ).rows,
    ).toEqual([
      { provider: "Manual subscription", origin: "manual" },
      { provider: "Provider fixture", origin: "tmdb" },
    ]);
    await expect(
      asUser(B, "select public.apply_title_metadata($1,$2::jsonb)", [
        t.id,
        JSON.stringify(payload),
      ]),
    ).rejects.toThrow(/Owned title/);
  });
  it("imports into a separate inbox, protects existing history, and is replay-safe", async () => {
    const t = (
      await asUser(A, "select id from public.titles where title='Reacher'")
    ).rows[0] as { id: string };
    const before = (
      await asUser(
        A,
        "select to_jsonb(w) as journal from public.watch_entries w where title_id=$1",
        [t.id],
      )
    ).rows;
    const pack = {
      schema_version: 1,
      generated_at: "2026-10-09T09:00:00Z",
      recommendations: [
        {
          title: "Reacher",
          media_type: "series",
          priority: 95,
          reason: "Friday reason",
          target_title_id: t.id,
          reviews: [],
          availability: [],
        },
        {
          title: "New Friday fixture",
          media_type: "movie",
          priority: 82,
          reason: "Fresh recommendation",
          reviews: [
            {
              source: "Publication",
              score: "4/5",
              score_type: "5-point",
              verified: true,
              captured_on: "2026-10-09",
              source_url: "https://example.com/review",
            },
          ],
          availability: [],
        },
      ],
    };
    const first = await asUser(
      A,
      "select public.import_recommendation_pack($1::jsonb,$2) result",
      [JSON.stringify(pack), "test-pack"],
    );
    expect(first.rows[0]).toEqual({
      result: { added: 1, refreshed: 2, kept: 0 },
    });
    expect(
      (
        await asUser(
          A,
          "select to_jsonb(w) as journal from public.watch_entries w where title_id=$1",
          [t.id],
        )
      ).rows,
    ).toEqual(before);
    const fresh = (
      await asUser(
        A,
        "select t.id,w.in_library from public.titles t join public.watch_entries w on w.title_id=t.id where t.title='New Friday fixture'",
      )
    ).rows[0] as { id: string; in_library: boolean };
    expect(fresh.in_library).toBe(false);
    expect(
      JSON.stringify(
        (
          await asUser(
            A,
            'select public.library_page(\'{"q":"New Friday fixture"}\') as result',
          )
        ).rows,
      ),
    ).toContain('"total":0');
    const replay = {
      ...pack,
      recommendations: pack.recommendations.map((r, i) =>
        i === 1 ? { ...r, target_title_id: fresh.id } : r,
      ),
    };
    expect(
      (
        await asUser(
          A,
          "select public.import_recommendation_pack($1::jsonb,$2) result",
          [JSON.stringify(replay), "test-pack"],
        )
      ).rows[0],
    ).toEqual({ result: { added: 0, refreshed: 0, kept: 2 } });
    await asUser(A, "select public.act_on_recommendation($1,'watching')", [
      fresh.id,
    ]);
    expect(
      (
        await asUser(
          A,
          "select status,in_library from public.watch_entries where title_id=$1",
          [fresh.id],
        )
      ).rows[0],
    ).toEqual({ status: "watching", in_library: true });
    await expect(
      asUser(B, "select public.act_on_recommendation($1,'skip')", [fresh.id]),
    ).rejects.toThrow(/Owned recommendation/);
  });
  it("does not replay an older pack over a newer recommendation", async () => {
    const t = (
      await asUser(A, "select id from public.titles where title='Reacher'")
    ).rows[0] as { id: string };
    const make = (reason: string) => ({
      schema_version: 1,
      generated_at: "2026-10-09T00:30:00+09:00",
      recommendations: [
        {
          title: "Reacher",
          media_type: "series",
          priority: 82,
          reason,
          target_title_id: t.id,
        },
      ],
    });
    await asUser(
      A,
      "select public.import_recommendation_pack($1::jsonb,'history-A')",
      [JSON.stringify(make("Earlier Friday"))],
    );
    await asUser(
      A,
      "select public.import_recommendation_pack($1::jsonb,'history-B')",
      [JSON.stringify(make("Latest Friday"))],
    );
    const replay = await asUser(
      A,
      "select public.import_recommendation_pack($1::jsonb,'history-A') as result",
      [JSON.stringify(make("Earlier Friday"))],
    );
    expect(replay.rows[0]).toEqual({
      result: { added: 0, refreshed: 0, kept: 1 },
    });
    expect(
      (
        await asUser(
          A,
          "select reason,recommended_on::text from public.recommendations where title_id=$1",
          [t.id],
        )
      ).rows[0],
    ).toEqual({ reason: "Latest Friday", recommended_on: "2026-10-09" });
  });
  it("rolls back a pack with an invalid cross-account match and denies anonymous RPC execution", async () => {
    const t = (await asUser(A, "select id from public.titles limit 1"))
      .rows[0] as { id: string };
    const pack = {
      schema_version: 1,
      generated_at: "2026-10-09T09:00:00Z",
      recommendations: [
        {
          title: "Rollback Friday",
          media_type: "movie",
          priority: 50,
          reason: "Must roll back",
        },
        {
          title: "Other owner",
          media_type: "series",
          priority: 50,
          reason: "Blocked",
          target_title_id: t.id,
        },
      ],
    };
    await expect(
      asUser(
        B,
        "select public.import_recommendation_pack($1::jsonb,'rollback')",
        [JSON.stringify(pack)],
      ),
    ).rejects.toThrow(/Invalid matched title/);
    expect(
      (
        await asUser(
          B,
          "select id from public.titles where title='Rollback Friday'",
        )
      ).rows,
    ).toHaveLength(0);
    await db.exec("set role anon");
    try {
      await expect(
        db.query("select public.import_recommendation_pack('{}','x')"),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });
});

it("round-trips V2.1 artwork, inbox membership, evidence provenance and recommendation history in backups", async () => {
  const input = titleSchema.parse({
    title: "V2.1 backup fixture",
    media_type: "movie",
    release_year: 2026,
    metadata: {
      state: "matched",
      poster_path: "/poster.jpg",
      backdrop_path: "/backdrop.jpg",
      runtime_minutes: 110,
      trailer: {
        key: "abcdefghijk",
        name: "Official trailer",
        site: "YouTube",
        official: true,
      },
    },
    watch: { status: "interested", priority: 82, in_library: false },
    reviews: [
      {
        source: "TMDb",
        score: "8/10",
        origin: "tmdb",
        evidence_key: "tmdb:rating",
        verified: true,
        captured_on: "2026-10-10",
        source_url: "https://www.themoviedb.org/movie/1",
      },
    ],
    availability: [
      {
        provider: "Fixture provider",
        region: "JP",
        kind: "rent",
        origin: "tmdb",
        logo_path: "/logo.jpg",
        fetched_at: "2026-10-10T12:00:00Z",
        evidence_key: "tmdb:JP:1:rent",
      },
    ],
    recommendation: {
      recommended_on: "2026-10-09",
      priority: 82,
      reason: "Latest",
      generated_at: "2026-10-09T09:00:00Z",
      pack_hash: "backup-pack",
      history: [
        {
          generated_at: "2026-10-02T09:00:00Z",
          pack_hash: "older-pack",
          reason: "Earlier",
          fit: "",
          caveat: "",
          priority: 75,
          source: "ChatGPT",
        },
      ],
    },
  });
  await imported(A, { version: 2, titles: [input], taste: [] });
  const backup = (
    await asUser(
      A,
      "select public.title_document(t) as doc from public.titles t where title='V2.1 backup fixture'",
    )
  ).rows[0] as { doc: unknown };
  await imported(B, { version: 2, titles: [backup.doc], taste: [] });
  const restored = (
    await asUser(
      B,
      "select public.title_document(t) as doc from public.titles t where title='V2.1 backup fixture'",
    )
  ).rows[0] as { doc: unknown };
  const parsed = titleSchema.parse(restored.doc);
  delete parsed.watch.updated_at;
  parsed.availability[0].fetched_at = new Date(
    parsed.availability[0].fetched_at!,
  )
    .toISOString()
    .replace(".000Z", "Z");
  parsed.recommendation!.generated_at = new Date(
    parsed.recommendation!.generated_at!,
  )
    .toISOString()
    .replace(".000Z", "Z");
  expect(parsed).toEqual(input);
});
