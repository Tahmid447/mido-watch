import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
process.loadEnvFile(".env.local");
const users = JSON.parse(readFileSync(".env.test-users.json", "utf8"));
const make = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
const anon = make(),
  a = make(),
  b = make();
for (const [client, user] of [
  [a, users[0]],
  [b, users[1]],
]) {
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  assert.equal(error, null, "Hosted password authentication");
}
const tables = [
  "titles",
  "watch_entries",
  "seasons",
  "review_snapshots",
  "availability",
  "recommendations",
  "taste_signals",
  "profiles",
];
for (const table of tables) {
  const unauth = await anon.from(table).select("*");
  assert.ok(
    unauth.error || unauth.data.length === 0,
    `Anon must not read ${table}`,
  );
  const foreign = await b.from(table).select("*").eq("user_id", users[0].id);
  assert.equal(foreign.error, null);
  assert.equal(foreign.data.length, 0, `B must not read A's ${table}`);
  const deletion = await b
    .from(table)
    .delete()
    .eq("user_id", users[0].id)
    .select();
  assert.equal(deletion.error, null);
  assert.equal(deletion.data.length, 0, `B must not delete A's ${table}`);
}
const { data: titles, error } = await a.from("titles").select("id").limit(1);
assert.equal(error, null);
assert.ok(titles.length);
const titleId = titles[0].id;
assert.ok(
  (
    await b.from("seasons").insert({
      user_id: users[1].id,
      title_id: titleId,
      number: 999,
      status: "watched",
    })
  ).error,
  "Cross-owner relation must fail",
);
assert.ok(
  (
    await b.from("titles").insert({
      user_id: users[0].id,
      title: "Unauthorized",
      media_type: "movie",
    })
  ).error,
  "Forged ownership must fail",
);
assert.ok(
  (await a.from("titles").update({ user_id: users[1].id }).eq("id", titleId))
    .error,
  "Ownership reassignment must fail",
);
for (const fn of ["export_library", "library_page"]) {
  const r = await anon.rpc(fn);
  assert.ok(r.error, `Anon must not call ${fn}`);
}
assert.ok(
  (
    await anon.rpc("import_library", {
      payload: { version: 2, titles: [], taste: [] },
    })
  ).error,
  "Anon import must fail",
);
const exportB = await b.rpc("export_library");
assert.equal(exportB.error, null);
assert.ok(exportB.data.titles.every((t) => !titles.some((a) => a.id === t.id)));
console.log(
  "Hosted Auth + REST/RLS verified: 8 tables deny anonymous reads and cross-user reads/deletes; forged ownership, reassignment, cross-owner relations, and anonymous RPCs denied.",
);

for (const [fn, args] of [
  [
    "apply_title_metadata",
    { p_title_id: titleId, payload: { metadata: { state: "matched" } } },
  ],
  ["act_on_recommendation", { p_title_id: titleId, p_action: "interested" }],
  [
    "import_recommendation_pack",
    {
      payload: {
        schema_version: 1,
        generated_at: "2026-10-09T09:00:00Z",
        recommendations: [
          {
            title: "Unauthorized matched pack",
            media_type: "movie",
            priority: 50,
            reason: "Denied",
            target_title_id: titleId,
          },
        ],
      },
      p_pack_hash: "cross-owner-test",
    },
  ],
]) {
  assert.ok((await anon.rpc(fn, args)).error, `Anonymous ${fn} must fail`);
  assert.ok((await b.rpc(fn, args)).error, `Foreign ${fn} must fail`);
}
console.log(
  "V2.1 invoker RPCs deny anonymous and cross-account metadata refresh, inbox actions and pack matching.",
);
