import "server-only";
import { z } from "zod";
import { metadataSchema, titleSchema, type Title } from "./model";
import { countryCode, selectMatch, type Candidate } from "./metadata-matching";
const path = z
  .string()
  .regex(/^\/[A-Za-z0-9_.-]+$/)
  .nullable()
  .catch(null);
const video = z.object({
  key: z.string(),
  name: z.string(),
  site: z.string(),
  type: z.string(),
  official: z.boolean().default(false),
  iso_639_1: z.string().optional(),
});
const provider = z.object({
  provider_id: z.number().int().positive(),
  provider_name: z.string(),
  logo_path: path,
});
const details = z.object({
  id: z.number().int().positive(),
  title: z.string().optional(),
  name: z.string().optional(),
  original_title: z.string().optional(),
  original_name: z.string().optional(),
  overview: z.string().default(""),
  poster_path: path,
  backdrop_path: path,
  release_date: z.string().optional(),
  first_air_date: z.string().optional(),
  runtime: z.number().nullable().optional(),
  original_language: z.string().default(""),
  genres: z.array(z.object({ name: z.string() })).default([]),
  origin_country: z.array(z.string()).optional(),
  production_countries: z
    .array(z.object({ iso_3166_1: z.string() }))
    .default([]),
  vote_average: z.number().default(0),
  vote_count: z.number().int().nonnegative().default(0),
  number_of_episodes: z.number().optional(),
  number_of_seasons: z.number().optional(),
  seasons: z
    .array(
      z.object({
        season_number: z.number().int(),
        name: z.string(),
        episode_count: z.number().int(),
        air_date: z.string().nullable(),
        overview: z.string().default(""),
      }),
    )
    .default([]),
  external_ids: z
    .object({ imdb_id: z.string().nullable().optional() })
    .optional(),
  videos: z.object({ results: z.array(video) }).optional(),
  "watch/providers": z
    .object({
      results: z.record(
        z.string(),
        z.object({
          link: z.string().url(),
          flatrate: z.array(provider).optional(),
          rent: z.array(provider).optional(),
          buy: z.array(provider).optional(),
        }),
      ),
    })
    .optional(),
});
export function tmdbConfigured() {
  return !!(
    process.env.TMDB_READ_ACCESS_TOKEN?.trim() ||
    process.env.TMDB_API_KEY?.trim()
  );
}
async function api(endpoint: string, query: Record<string, string> = {}) {
  if (!tmdbConfigured())
    throw new Error(
      "Add TMDB_READ_ACCESS_TOKEN or TMDB_API_KEY to the server environment first.",
    );
  const url = new URL(`https://api.themoviedb.org/3/${endpoint}`);
  for (const [key, value] of Object.entries(query))
    url.searchParams.set(key, value);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.TMDB_READ_ACCESS_TOKEN?.trim())
    headers.Authorization = `Bearer ${process.env.TMDB_READ_ACCESS_TOKEN.trim()}`;
  else url.searchParams.set("api_key", process.env.TMDB_API_KEY!.trim());
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (response.ok) return response.json();
    if ([429, 502, 503, 504].includes(response.status) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      continue;
    }
    throw new Error(
      response.status === 401
        ? "TMDb rejected the configured token. Check the API Read Access Token."
        : `TMDb request failed (${response.status}). Try refreshing later.`,
    );
  }
  throw new Error("TMDb is temporarily unavailable.");
}
export async function searchMetadata(
  t: Title,
  query?: string,
): Promise<Candidate[]> {
  const type = t.media_type === "series" ? "tv" : "movie";
  const clean = (query || t.title)
    .replace(/\s*\((?:\d{4}|UK|US|India|Japan|Korea)\)\s*/gi, " ")
    .trim();
  const params: Record<string, string> = {
    query: clean,
    language: "en-US",
    include_adult: "false",
  };
  if (t.release_year && !query)
    params[type === "tv" ? "first_air_date_year" : "year"] = String(
      t.release_year,
    );
  const result = z
    .object({
      results: z.array(
        z.object({
          id: z.number().int().positive(),
          title: z.string().optional(),
          name: z.string().optional(),
          original_title: z.string().optional(),
          original_name: z.string().optional(),
          release_date: z.string().optional(),
          first_air_date: z.string().optional(),
          origin_country: z.array(z.string()).optional(),
          poster_path: path,
          overview: z.string().default(""),
        }),
      ),
    })
    .parse(await api(`search/${type}`, params));
  // Movie search omits territory; resolve each plausible result before trusting country evidence.
  return Promise.all(
    result.results.slice(0, 12).map(async (c) => {
      let countries = c.origin_country ?? [];
      if (type === "movie" && countryCode(t.country)) {
        const d = details.parse(await api(`movie/${c.id}`));
        countries = d.production_countries.map((x) => x.iso_3166_1);
      }
      const date = c.release_date || c.first_air_date;
      return {
        id: c.id,
        title: c.title || c.name || "",
        original_title: c.original_title || c.original_name || "",
        year: date ? Number(date.slice(0, 4)) : null,
        countries,
        poster_path: c.poster_path,
        overview: c.overview,
      };
    }),
  );
}
export async function fetchMetadata(t: Title, id: number, region: string) {
  const type = t.media_type === "series" ? "tv" : "movie";
  const d = details.parse(
    await api(`${type}/${z.number().int().positive().parse(id)}`, {
      language: "en-US",
      append_to_response: "videos,external_ids,watch/providers",
    }),
  );
  const now = new Date().toISOString(),
    day = now.slice(0, 10);
  const date = z.iso.date().safeParse(d.release_date || d.first_air_date);
  const trailer = d.videos?.results
    .filter(
      (v) =>
        v.official &&
        v.site === "YouTube" &&
        v.type === "Trailer" &&
        /^[A-Za-z0-9_-]{11}$/.test(v.key),
    )
    .sort(
      (a, b) => Number(b.iso_639_1 === "en") - Number(a.iso_639_1 === "en"),
    )[0];
  const metadata = metadataSchema.parse({
    state: "matched",
    refreshed_at: now,
    poster_path: d.poster_path,
    backdrop_path: d.backdrop_path,
    release_date: date.success ? date.data : null,
    genres: d.genres.map((g) => g.name),
    runtime_minutes: d.runtime ?? null,
    original_language: d.original_language,
    episode_count: d.number_of_episodes ?? null,
    season_count: d.number_of_seasons ?? null,
    trailer: trailer
      ? {
          key: trailer.key,
          name: trailer.name,
          site: "YouTube",
          official: true,
        }
      : null,
    season_info: d.seasons.map((s) => ({
      number: s.season_number,
      name: s.name,
      episode_count: s.episode_count,
      air_date: z.iso.date().safeParse(s.air_date).success ? s.air_date : null,
      overview: s.overview,
    })),
  });
  const countryProviders = d["watch/providers"]?.results[region];
  const availability = countryProviders
    ? (
        [
          ["flatrate", "subscription"],
          ["rent", "rent"],
          ["buy", "buy"],
        ] as const
      ).flatMap(([key, kind]) =>
        (countryProviders[key] ?? []).map((p) => ({
          region,
          provider: p.provider_name,
          kind,
          origin: "tmdb",
          logo_path: p.logo_path,
          fetched_at: now,
          source_url: countryProviders.link,
          evidence_key: `tmdb:${region}:${p.provider_id}:${kind}`,
          notes:
            "Provider metadata supplied by TMDb, powered by JustWatch. Availability can change.",
        })),
      )
    : [];
  return {
    metadata,
    tmdb_id: d.id,
    original_title: d.original_title || d.original_name || null,
    synopsis: d.overview,
    imdb_id: titleSchema.shape.imdb_id.safeParse(d.external_ids?.imdb_id)
      .success
      ? (d.external_ids?.imdb_id ?? null)
      : null,
    release_year: date.success ? Number(date.data.slice(0, 4)) : null,
    region,
    reviews:
      d.vote_count > 0
        ? [
            {
              source: "TMDb",
              score: `${d.vote_average.toFixed(1)}/10`,
              score_type: "TMDb user rating · 10-point scale",
              vote_count: d.vote_count,
              captured_on: day,
              source_url: `https://www.themoviedb.org/${type}/${d.id}`,
              verified: true,
              origin: "tmdb",
              evidence_key: "tmdb:rating",
              notes: "Community rating; separate from your personal rating.",
            },
          ]
        : [],
    availability,
  };
}
export async function resolveMetadata(
  t: Title,
  region: string,
  selected?: number,
  query?: string,
) {
  if (selected || t.tmdb_id)
    return fetchMetadata(t, selected || t.tmdb_id!, region);
  const match = selectMatch(t, await searchMetadata(t, query));
  return match.match
    ? fetchMetadata(t, match.match.id, region)
    : {
        metadata: metadataSchema.parse({
          ...t.metadata,
          state: match.state,
          candidates: match.candidates,
          refreshed_at: new Date().toISOString(),
          error: null,
        }),
      };
}
