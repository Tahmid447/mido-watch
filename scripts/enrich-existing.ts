/** Local audit runner: reads an ignored owned-title snapshot and writes only external metadata. */
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { titleSchema } from "../src/lib/model";
import { resolveMetadata, tmdbConfigured } from "../src/lib/tmdb";
process.loadEnvFile(".env.local");
if (!tmdbConfigured())
  throw new Error("Configure TMDB_READ_ACCESS_TOKEN first.");
const schema = titleSchema.extend({ id: z.uuid(), updated_at: z.string() });
const titles = z
  .array(schema)
  .parse(JSON.parse(readFileSync(".env.enrichment-input.json", "utf8")));
const results: {
  id: string;
  title: string;
  state: string;
  payload: unknown;
}[] = [];
for (const t of titles) {
  try {
    const payload = await resolveMetadata(t, "JP");
    results.push({
      id: t.id,
      title: t.title,
      state: payload.metadata.state,
      payload,
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Metadata request failed";
    results.push({
      id: t.id,
      title: t.title,
      state: "error",
      payload: {
        metadata: {
          ...t.metadata,
          state: "error",
          error,
          refreshed_at: new Date().toISOString(),
        },
      },
    });
  }
  writeFileSync(".env.enrichment-results.json", JSON.stringify(results), {
    mode: 0o600,
  });
  console.log(
    `${results.length}/${titles.length} ${t.title}: ${results.at(-1)!.state}`,
  );
}
console.log(
  JSON.stringify({
    matched: results.filter((r) => r.state === "matched").length,
    review: results.filter((r) => r.state === "needs-review").length,
    failed: results.filter((r) => ["error", "no-result"].includes(r.state))
      .length,
  }),
);
