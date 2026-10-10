import { z } from "zod";
import {
  backupSchema,
  defaultTaste,
  identity,
  titleSchema,
  type Backup,
  type TitleInput,
} from "./model";
const legacySchema = z.object({
  title: z.string().min(1),
  type: z.enum(["Movie", "Series"]),
  status: z.enum(["interested", "not-watched", "watching", "watched", "skip"]),
  country: z.string().optional(),
  platform: z.string().optional(),
  priority: z.number().min(0).max(100).optional(),
  note: z.string().optional(),
  imdb: z.string().optional(),
  rtCritics: z.string().optional(),
  rtAudience: z.string().optional(),
});
export function parseImport(input: unknown, knownSeed = false): Backup {
  if (
    typeof input === "object" &&
    input &&
    "version" in input &&
    input.version === 2
  )
    return backupSchema.parse(input);
  const raw = Array.isArray(input)
    ? input
    : z
        .object({
          version: z.literal(1).optional(),
          titles: z.array(z.unknown()),
        })
        .parse(input).titles;
  const rows = z.array(legacySchema).max(10000).parse(raw);
  const titles = new Map<string, TitleInput>();
  for (const row of rows) {
    const seasonMatch = row.title.match(
      /\s*[—–-]\s*Seasons?\s+(\d+)(?:\s*&\s*(\d+))?$/i,
    );
    const name = seasonMatch
      ? row.title.slice(0, seasonMatch.index).trim()
      : row.title;
    const entry = titleSchema.parse({
      title: name,
      media_type: row.type.toLowerCase(),
      country: row.country ?? "",
      watch: {
        status: row.status,
        notes: seasonMatch ? "" : (row.note ?? ""),
        priority: row.priority ?? 0,
      },
      availability: row.platform
        ? [
            {
              region: row.platform.includes("Japan") ? "JP" : "ZZ",
              provider: row.platform.replace(/ Japan$/, ""),
              notes: "Unverified V1 platform claim. Region ZZ means unknown.",
            },
          ]
        : [],
    });
    const key = identity(entry);
    const current = titles.get(key) ?? entry;
    if (seasonMatch) {
      for (const number of [
        Number(seasonMatch[1]),
        ...(seasonMatch[2] ? [Number(seasonMatch[2])] : []),
      ]) {
        if (current.seasons.some((s) => s.number === number))
          throw new Error(`Duplicate season ${number} for ${name}`);
        const isReacher = knownSeed && name === "Reacher";
        current.seasons.push({
          number,
          status: isReacher && number === 4 ? "not-watched" : row.status,
          rating: null,
          notes: row.note ?? "",
          completed_on: null,
          rank:
            isReacher && number <= 3
              ? ({ 1: 2, 2: 1, 3: 3 }[number] ?? null)
              : null,
        });
      }
      current.watch.priority = Math.max(
        current.watch.priority,
        row.priority ?? 0,
      );
      current.watch.status = current.seasons.every(
        (s) => s.status === "watched",
      )
        ? "watched"
        : "watching";
    } else if (titles.has(key)) {
      throw new Error(
        `Duplicate title in import: ${name}. Resolve it before importing.`,
      );
    }
    for (const [source, value] of [
      ["IMDb", row.imdb],
      ["Rotten Tomatoes critics", row.rtCritics],
      ["Rotten Tomatoes audience", row.rtAudience],
    ]) {
      if (value && value !== "—")
        current.reviews.push({
          source: source!,
          origin: "manual",
          evidence_key: null,
          score: value,
          score_type: source === "IMDb" ? "out of 10" : "percent",
          critic_score: null,
          audience_score: null,
          vote_count: null,
          captured_on: null,
          source_url: null,
          verified: false,
          notes: `Unverified legacy value from ${row.title}; not independently checked.`,
        });
    }
    titles.set(key, current);
  }
  if (knownSeed) {
    const reacher = [...titles.values()].find((t) => t.title === "Reacher");
    if (reacher) {
      reacher.watch.notes =
        "Personal ranking: Season 2 > Season 1 > Season 3. Season 3 was not bad, but less impressive than Seasons 1 and 2.";
    }
  }
  return backupSchema.parse({
    version: 2,
    titles: [...titles.values()],
    taste: knownSeed ? defaultTaste : [],
  });
}
