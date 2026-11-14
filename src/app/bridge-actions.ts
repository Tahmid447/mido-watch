"use server";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { session, titleById, profile, documentSchema } from "@/lib/data";
import {
  matchPack,
  recommendationPackSchema,
  type PackMatch,
} from "@/lib/recommendation-pack";
import { resolveMetadata, tmdbConfigured } from "@/lib/tmdb";
import { metadataSchema } from "@/lib/model";
import type { Result } from "./actions";
async function ownedTitles() {
  const { db } = await session();
  const { data, error } = await db.rpc("export_library");
  if (error) throw new Error(error.message);
  return z.object({ titles: z.array(documentSchema) }).parse(data).titles;
}
const problem = (e: unknown) =>
  e instanceof z.ZodError
    ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
    : e instanceof Error
      ? e.message
      : "Unable to complete this request.";
function parse(text: string) {
  if (Buffer.byteLength(text) > 2_000_000)
    throw new Error("Recommendation pack exceeds 2 MB.");
  return recommendationPackSchema.parse(JSON.parse(text));
}
export async function previewPack(
  text: string,
): Promise<{ matches?: PackMatch[]; error?: string }> {
  await session();
  try {
    return { matches: matchPack(parse(text), await ownedTitles()) };
  } catch (e) {
    return { error: problem(e) };
  }
}
export async function confirmPack(
  text: string,
  choices: Record<string, string>,
): Promise<Result> {
  const { db } = await session();
  try {
    const pack = parse(text),
      matches = matchPack(pack, await ownedTitles());
    const seen = new Set<string>();
    const entries = pack.recommendations.map((r, i) => {
      const m = matches[i],
        choice = choices[String(i)];
      if (m.kind === "ambiguous" && !choice)
        throw new Error(
          `Choose a match or create a separate title for ${r.title}.`,
        );
      const target =
        m.kind === "matched"
          ? m.target
          : choice && choice !== "new"
            ? choice
            : null;
      if (
        target &&
        m.kind !== "matched" &&
        !m.candidates.some((c) => c.id === target)
      )
        throw new Error("Invalid title choice. Preview again.");
      if (target && seen.has(target))
        throw new Error(
          "Two recommendations match the same title. Remove the duplicate and preview again.",
        );
      if (target) seen.add(target);
      return { ...r, target_title_id: target };
    });
    const hash = createHash("sha256")
      .update(JSON.stringify(pack))
      .digest("hex");
    const { data, error } = await db.rpc("import_recommendation_pack", {
      payload: { ...pack, recommendations: entries },
      p_pack_hash: hash,
    });
    if (error) throw new Error(error.message);
    const counts = z
      .object({ added: z.number(), refreshed: z.number(), kept: z.number() })
      .parse(data);
    revalidatePath("/", "layout");
    return {
      message: `Imported ${counts.added} new inbox titles; refreshed ${counts.refreshed} recommendations; ${counts.kept} already up to date. Your journals and ratings were preserved.`,
    };
  } catch (e) {
    return { error: problem(e) };
  }
}
async function enrich(id: string, selected?: number, query?: string) {
  const { db } = await session();
  const [t, p] = await Promise.all([titleById(id), profile()]);
  if (!t) throw new Error("Title not found.");
  if (!tmdbConfigured())
    throw new Error(
      "Add TMDB_READ_ACCESS_TOKEN or TMDB_API_KEY to the server environment first.",
    );
  try {
    const payload = await resolveMetadata(t, p.region, selected, query);
    const { error } = await db.rpc("apply_title_metadata", {
      p_title_id: id,
      payload,
    });
    if (error) throw new Error(error.message);
    return payload.metadata.state;
  } catch (e) {
    const error = problem(e);
    await db
      .from("titles")
      .update({
        metadata: metadataSchema.parse({
          ...t.metadata,
          state: "error",
          error,
          refreshed_at: new Date().toISOString(),
        }),
      })
      .eq("id", id);
    throw new Error(error);
  }
}
export async function refreshMetadata(_: Result, f: FormData): Promise<Result> {
  await session();
  try {
    const id = String(f.get("title_id") ?? ""),
      selected = f.get("tmdb_id")
        ? z.coerce.number().int().positive().parse(f.get("tmdb_id"))
        : undefined;
    if (id) {
      const state = await enrich(
        z.uuid().parse(id),
        selected,
        String(f.get("query") ?? "").slice(0, 300) || undefined,
      );
      revalidatePath("/", "layout");
      return {
        message:
          state === "matched"
            ? "Metadata refreshed. Your journal is unchanged."
            : state === "needs-review"
              ? "Choose the correct match below."
              : "No confident result. Try another search or enter a TMDb ID.",
      };
    }
    const titles = (await ownedTitles())
      .filter((t) =>
        ["missing", "error", "no-result"].includes(t.metadata.state),
      )
      .slice(0, 6);
    if (!tmdbConfigured())
      throw new Error(
        "Add TMDB_READ_ACCESS_TOKEN or TMDB_API_KEY to the server environment first.",
      );
    const count = { matched: 0, review: 0, failed: 0 };
    for (const t of titles) {
      try {
        const state = await enrich(t.id);
        if (state === "matched") count.matched++;
        else if (state === "needs-review") count.review++;
        else count.failed++;
      } catch {
        count.failed++;
      }
    }
    revalidatePath("/", "layout");
    return {
      message: `Checked ${titles.length} titles: ${count.matched} matched, ${count.review} need review, ${count.failed} failed/no result. Refresh again for the next batch.`,
    };
  } catch (e) {
    return { error: problem(e) };
  }
}
