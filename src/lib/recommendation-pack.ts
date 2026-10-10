import { z } from "zod";
import {
  titleSchema,
  reviewSchema,
  availabilitySchema,
  type Title,
  type Backup,
} from "./model";
import { normalizedTitle, countryCode } from "./metadata-matching";
const entry = z
  .object({
    title: titleSchema.shape.title,
    original_title: titleSchema.shape.original_title,
    media_type: titleSchema.shape.media_type,
    release_year: titleSchema.shape.release_year,
    country: titleSchema.shape.country,
    imdb_id: titleSchema.shape.imdb_id,
    tmdb_id: titleSchema.shape.tmdb_id,
    priority: z.number().int().min(0).max(100),
    reason: z.string().min(1).max(10000),
    fit: z.string().max(10000).default(""),
    caveat: z.string().max(10000).default(""),
    runtime_or_episode_count: z.string().max(300).default(""),
    reviews: z.array(reviewSchema).max(50).default([]),
    availability: z.array(availabilitySchema).max(50).default([]),
  })
  .strict();
export const recommendationPackSchema = z
  .object({
    schema_version: z.literal(1),
    generated_at: z.iso.datetime({ offset: true }),
    recommendations: z.array(entry).min(1).max(100),
  })
  .strict()
  .superRefine((pack, ctx) => {
    const seen = new Set<string>();
    pack.recommendations.forEach((r, i) => {
      const key = r.tmdb_id
        ? `${r.media_type}:tmdb:${r.tmdb_id}`
        : r.imdb_id
          ? `imdb:${r.imdb_id}`
          : `${normalizedTitle(r.title)}:${r.media_type}:${r.release_year ?? ""}:${r.country.toLowerCase()}`;
      if (seen.has(key))
        ctx.addIssue({
          code: "custom",
          path: ["recommendations", i],
          message: "Duplicate recommendation in this pack",
        });
      seen.add(key);
    });
  });
export type RecommendationPack = z.infer<typeof recommendationPackSchema>;
export type PackMatch = {
  index: number;
  kind: "matched" | "new" | "ambiguous";
  target: string | null;
  candidates: {
    id: string;
    title: string;
    year: number | null;
    country: string;
  }[];
  explanation: string;
};
export function matchPack(
  pack: RecommendationPack,
  titles: Title[],
): PackMatch[] {
  return pack.recommendations.map((r, index) => {
    const sameType = titles.filter((t) => t.media_type === r.media_type);
    const byId = sameType.filter(
      (t) =>
        (r.tmdb_id !== null && t.tmdb_id === r.tmdb_id) ||
        (r.imdb_id !== null && t.imdb_id === r.imdb_id),
    );
    const compatible = (t: Title) =>
      !(r.tmdb_id && t.tmdb_id && r.tmdb_id !== t.tmdb_id) &&
      !(r.imdb_id && t.imdb_id && r.imdb_id !== t.imdb_id);
    const byName = sameType.filter(
      (t) =>
        normalizedTitle(t.title) === normalizedTitle(r.title) ||
        (r.original_title &&
          normalizedTitle(t.original_title || t.title) ===
            normalizedTitle(r.original_title)),
    );
    const exact = byName.filter(
      (t) =>
        compatible(t) &&
        ((r.release_year !== null && t.release_year === r.release_year) ||
          (r.release_year === null && t.release_year === null)) &&
        ((countryCode(r.country) &&
          countryCode(t.country) === countryCode(r.country)) ||
          r.country.toLowerCase() === t.country.toLowerCase()),
    );
    const candidates = byId.length ? byId : byName;
    const match =
      byId.length === 1 && compatible(byId[0])
        ? byId[0]
        : !byId.length &&
            exact.length === 1 &&
            byName.length === 1 &&
            (r.release_year !== null || !!r.country.trim())
          ? exact[0]
          : null;
    return {
      index,
      kind: match ? "matched" : candidates.length ? "ambiguous" : "new",
      target: match?.id ?? null,
      candidates: candidates.map((t) => ({
        id: t.id,
        title: t.title,
        year: t.release_year,
        country: t.country,
      })),
      explanation: match
        ? byId.length
          ? "External ID agrees"
          : "Title, type, year and territory agree"
        : candidates.length
          ? "Review the identity before importing"
          : "Will arrive in your recommendation inbox",
    };
  });
}
export function chatgptContext(backup: Backup) {
  return {
    schema_version: 1,
    exported_at: new Date().toISOString(),
    region: backup.profile?.region ?? "JP",
    taste: backup.taste,
    titles: backup.titles.map((t) => ({
      title: t.title,
      media_type: t.media_type,
      release_year: t.release_year,
      country: t.country,
      ...(t.imdb_id ? { imdb_id: t.imdb_id } : {}),
      ...(t.tmdb_id ? { tmdb_id: t.tmdb_id } : {}),
      status: t.watch.status,
      rating: t.watch.rating,
      ...(t.watch.notes ? { notes: t.watch.notes } : {}),
      ...(t.watch.favorite ? { favorite: true } : {}),
      ...(t.watch.completed_on ? { completed_on: t.watch.completed_on } : {}),
      ...(t.seasons.length
        ? {
            seasons: t.seasons.map((s) => ({
              number: s.number,
              status: s.status,
              rating: s.rating,
              rank: s.rank,
              ...(s.notes ? { notes: s.notes } : {}),
              ...(s.completed_on ? { completed_on: s.completed_on } : {}),
            })),
          }
        : {}),
      ...(t.recommendation
        ? {
            recommendation: {
              state: t.recommendation.state,
              in_library: t.watch.in_library,
              date: t.recommendation.recommended_on,
              reason: t.recommendation.reason,
              caveat: t.recommendation.caveat,
            },
          }
        : {}),
    })),
  };
}
