import { z } from "zod";
export const statuses = [
  "interested",
  "not-watched",
  "watching",
  "watched",
  "skip",
] as const;
export const statusLabels: Record<Status, string> = {
  interested: "Interested",
  "not-watched": "Not watched",
  watching: "Watching",
  watched: "Watched",
  skip: "Skip",
};
export type Status = (typeof statuses)[number];
const text = z.string().max(10000);
const nullableText = text.nullable().default(null);
const date = z.iso.date().nullable().default(null);
const url = z
  .string()
  .url()
  .refine((s) => /^https?:\/\//.test(s), "Use an HTTP or HTTPS URL")
  .nullable()
  .default(null);
const imagePath = z
  .string()
  .regex(/^\/[A-Za-z0-9_.-]+$/)
  .nullable()
  .default(null);
export const trailerSchema = z.object({
  key: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  name: z.string().max(300),
  official: z.literal(true),
  site: z.literal("YouTube"),
});
export const candidateSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  original_title: z.string(),
  year: z.number().nullable(),
  countries: z.array(z.string()),
  poster_path: imagePath,
  overview: z.string().default(""),
});
export const metadataSchema = z.object({
  state: z
    .enum(["missing", "matched", "needs-review", "no-result", "error"])
    .default("missing"),
  refreshed_at: z.string().nullable().default(null),
  error: z.string().nullable().default(null),
  poster_path: imagePath,
  backdrop_path: imagePath,
  release_date: z.iso.date().nullable().default(null),
  genres: z.array(z.string()).default([]),
  runtime_minutes: z.number().int().nonnegative().nullable().default(null),
  original_language: z.string().default(""),
  episode_count: z.number().int().nonnegative().nullable().default(null),
  season_count: z.number().int().nonnegative().nullable().default(null),
  trailer: trailerSchema.nullable().default(null),
  candidates: z.array(candidateSchema).max(20).default([]),
  season_info: z
    .array(
      z.object({
        number: z.number().int().nonnegative(),
        name: z.string(),
        episode_count: z.number().int().nonnegative(),
        air_date: z.iso.date().nullable(),
        overview: z.string(),
      }),
    )
    .default([]),
});
export const watchSchema = z.object({
  updated_at: z.string().optional(),
  status: z.enum(statuses).default("interested"),
  rating: z.number().min(1).max(10).nullable().default(null),
  notes: text.default(""),
  priority: z.number().int().min(0).max(100).default(50),
  started_on: date,
  completed_on: date,
  favorite: z.boolean().default(false),
  in_library: z.boolean().default(true),
});
export const seasonSchema = watchSchema
  .omit({ priority: true, favorite: true, in_library: true, started_on: true })
  .extend({
    number: z.number().int().min(0).max(1000),
    rank: z.number().int().min(1).nullable().default(null),
  });
export const reviewSchema = z
  .object({
    source: z.string().min(1).max(200),
    origin: z.enum(["manual", "tmdb", "chatgpt"]).default("manual"),
    evidence_key: z.string().nullable().default(null),
    score: nullableText,
    score_type: text.default("source-specific"),
    critic_score: nullableText,
    audience_score: nullableText,
    vote_count: z.number().int().nonnegative().nullable().default(null),
    captured_on: date,
    source_url: url,
    notes: text.default(""),
    verified: z.boolean().default(false),
  })
  .refine(
    (r) => !r.verified || !!(r.source_url && r.captured_on),
    "Verified reviews need a source URL and capture date",
  );
export const availabilitySchema = z
  .object({
    region: z
      .string()
      .regex(/^[A-Z]{2}$|^ZZ$/)
      .default("JP"),
    provider: z.string().min(1).max(200),
    origin: z.enum(["manual", "tmdb", "chatgpt"]).default("manual"),
    logo_path: imagePath,
    fetched_at: z.string().nullable().default(null),
    evidence_key: z.string().nullable().default(null),
    kind: z
      .enum(["subscription", "rent", "buy", "theatrical", "unknown"])
      .default("unknown"),
    release_on: date,
    ott_on: date,
    theatrical_on: date,
    verified_on: date,
    source_url: url,
    notes: text.default(""),
  })
  .refine(
    (a) => !a.verified_on || !!a.source_url,
    "Verified availability needs a source URL",
  );
export const recommendationSchema = z.object({
  recommended_on: z.iso.date(),
  generated_at: z.string().nullable().default(null),
  pack_hash: z.string().nullable().default(null),
  runtime_or_episode_count: text.default(""),
  history: z
    .array(
      z.object({
        generated_at: z.string(),
        pack_hash: z.string().nullable().default(null),
        reason: text,
        fit: text,
        caveat: text,
        priority: z.number(),
        source: text,
      }),
    )
    .default([]),
  priority: z.number().min(0).max(100).default(50),
  reason: text,
  fit: text.default(""),
  caveat: text.default(""),
  availability_note: text.default(""),
  source: text.default("Manual"),
  state: z.enum(["new", "accepted", "dismissed"]).default("new"),
});
export const titleSchema = z.object({
  title: z.string().trim().min(1).max(300),
  original_title: nullableText,
  media_type: z.enum(["movie", "series"]),
  release_year: z.number().int().min(1800).max(2200).nullable().default(null),
  country: z.string().max(100).default(""),
  synopsis: text.default(""),
  metadata: metadataSchema.default(() => metadataSchema.parse({})),
  poster_url: url,
  imdb_id: z
    .string()
    .regex(/^tt\d+$/)
    .nullable()
    .default(null),
  tmdb_id: z.number().int().positive().nullable().default(null),
  provider_ids: z.record(z.string(), z.string()).default({}),
  tags: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  watch: watchSchema.default(() => watchSchema.parse({})),
  seasons: z.array(seasonSchema).max(1001).default([]),
  reviews: z.array(reviewSchema).max(100).default([]),
  availability: z.array(availabilitySchema).max(100).default([]),
  recommendation: recommendationSchema.nullable().default(null),
});
export type TitleInput = z.infer<typeof titleSchema>;
export type Title = TitleInput & { id: string; updated_at: string };
export type Watch = z.infer<typeof watchSchema>;
export type Season = z.infer<typeof seasonSchema>;
export const tasteSchema = z.object({
  signal: z.string().trim().min(1).max(100),
  weight: z.number().int().min(-5).max(5),
  notes: text.default(""),
});
export const profileSchema = z.object({
  display_name: z.string().trim().max(100).default("Mido"),
  region: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .default("JP"),
});
export const backupSchema = z.object({
  version: z.literal(2),
  exportedAt: z.string().optional(),
  titles: z.array(titleSchema).max(10000),
  taste: z.array(tasteSchema).max(200).default([]),
  profile: profileSchema.optional(),
});
export type Backup = z.infer<typeof backupSchema>;
export const defaultTaste = [
  "spy / espionage",
  "investigative mystery",
  "government conspiracy",
  "clever suspense",
  "crime thriller",
  "competent protagonist",
  "supernatural mystery",
  "high-concept mystery",
  "psychological thriller",
  "courtroom / social drama",
  "strong payoff",
  "emotional drama",
  "dark comedy",
  "Japanese prestige drama",
  "Indian crime / thriller",
  "slow-burn storytelling",
  "action",
  "romance inside thrillers",
].map((signal, i) => ({
  signal,
  weight: i < 5 ? 5 : i < 11 ? 4 : 2,
  notes: "",
}));
export function identity(
  t: Pick<TitleInput, "title" | "media_type" | "release_year" | "country">,
) {
  return [
    t.title.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " "),
    t.media_type,
    t.release_year ?? "",
    t.country.trim().toLowerCase(),
  ].join("|");
}
