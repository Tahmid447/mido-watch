import { describe, it, expect } from "vitest";
import { titleSchema, type Title } from "../src/lib/model";
import {
  rankTonight,
  auditMatches,
  titleThemes,
  type TonightOptions,
} from "../src/lib/tonight";
const options: TonightOptions = {
  time: "Under 2 hours",
  mood: "Police investigation",
  intensity: "Any",
  format: "Either",
};
const make = (title: string, patch: Record<string, unknown> = {}): Title => ({
  ...titleSchema.parse({
    title,
    media_type: "movie",
    synopsis: "A grounded police investigation with evidence gathering",
    country: "Japan",
    metadata: { runtime_minutes: 105 },
    ...patch,
  }),
  id: crypto.randomUUID(),
  updated_at: "2026-11-14T09:00:00Z",
});
describe("Tonight’s transparent rules", () => {
  it("excludes completed/skipped/dismissed picks and movies outside the time window", () => {
    const titles = [
      make("Finished", { watch: { status: "watched" } }),
      make("Skipped", { watch: { status: "skip" } }),
      make("Long", { metadata: { runtime_minutes: 140 } }),
      make("Dismissed", {
        recommendation: {
          recommended_on: "2026-11-14",
          reason: "Example",
          state: "dismissed",
        },
      }),
      make("Fits"),
    ];
    expect(rankTonight(titles, [], options).map((p) => p.title.title)).toEqual([
      "Fits",
    ]);
  });
  it("applies explicit negative evidence more strongly than a priority advantage", () => {
    const unrealistic = make("High level but wrong fit", {
        watch: { priority: 100 },
        recommendation: {
          recommended_on: "2026-11-14",
          priority: 100,
          reason: "A mystery",
          caveat: "Impossible schemes and excessive plot armor",
        },
      }),
      grounded = make("Grounded", { watch: { priority: 60 } });
    const picks = rankTonight(
      [unrealistic, grounded],
      [{ signal: "excessive plot armor", weight: -5, notes: "" }],
      options,
    );
    expect(picks[0].title.title).toBe("Grounded");
    expect(picks[1].breakdown).toContainEqual({
      label: "Known disliked traits",
      points: -25,
    });
  });
  it("does not pretend unknown negative traits are known", () => {
    expect(
      rankTonight(
        [make("Unknown plausibility")],
        [{ signal: "excessive plot armor", weight: -5, notes: "" }],
        options,
      )[0].breakdown.some((b) => b.label === "Known disliked traits"),
    ).toBe(false);
  });
  it("allows horror only with mystery, coherent rules or substantial verified quality evidence", () => {
    const plain = make("Plain horror", {
        synopsis: "Pure horror with jump scares",
        metadata: { genres: ["Horror"] },
      }),
      mystery = make("Investigative horror", {
        metadata: { genres: ["Horror", "Mystery"] },
      }),
      rated = make("Exceptional horror", {
        synopsis: "A supernatural experience",
        metadata: { genres: ["Horror"] },
        reviews: [
          {
            source: "TMDb",
            score: "8.5/10",
            verified: true,
            captured_on: "2026-11-14",
            source_url: "https://www.themoviedb.org/movie/1",
            vote_count: 500,
          },
        ],
      });
    expect(
      rankTonight([plain, mystery, rated], [], {
        ...options,
        time: "Long session",
      }).map((p) => p.title.title),
    ).not.toContain("Plain horror");
    expect(rankTonight([mystery, rated], [], options)).toHaveLength(2);
  });
  it("prefers an unfinished series for episode mood and rewards sourced regional providers", () => {
    const current = make("Current", {
        media_type: "series",
        watch: { status: "watching" },
        availability: [
          {
            region: "JP",
            provider: "Fixture",
            kind: "subscription",
            origin: "tmdb",
            fetched_at: "2026-11-14T09:00:00Z",
          },
        ],
      }),
      other = make("Other");
    expect(
      rankTonight([other, current], [], {
        ...options,
        time: "One or two episodes",
      })[0].title.title,
    ).toBe("Current");
    expect(
      rankTonight([other, current], [], { ...options, format: "Movie" }),
    ).toHaveLength(1);
  });
  it("flags unknown runtime and uncertain progress without inventing certainty", () => {
    const p = rankTonight(
      [
        make("Uncertain", {
          watch: { status: "watching", confirmation_needed: true },
          metadata: {},
        }),
      ],
      [],
      options,
    )[0];
    expect(p.caveats.join(" ")).toMatch(/Runtime is not confirmed/);
    expect(p.breakdown.some((b) => b.points < 0)).toBe(true);
  });
});
it("audit filters use explicit status/confirmation flags and actual catalog themes", () => {
  const t = make("Audit fixture", {
    watch: { confirmation_needed: true },
    metadata: { original_language: "ja" },
  });
  expect(auditMatches(t, "Need confirmation")).toBe(true);
  expect(auditMatches(t, "Watched")).toBe(false);
  expect(auditMatches(t, "Not watched")).toBe(true);
  expect(titleThemes(t)).toContain("Police investigation");
  expect(titleThemes(t)).toContain("Japanese");
});

it("does not confuse acronym substrings with intelligence or police themes", () => {
  const t = make("Social drama", {
    synopsis: "A social drama about an accidental meeting.",
    metadata: { genres: ["Drama"] },
  });
  expect(titleThemes(t)).not.toContain("Spy / intelligence");
  expect(titleThemes(t)).not.toContain("Police investigation");
});
it("treats a started independent season as unfinished even when the series journal is interested", () => {
  const t = make("Independent season", {
    media_type: "series",
    seasons: [{ number: 1, status: "watching" }],
  });
  expect(
    rankTonight([t], [], { ...options, time: "One or two episodes" })[0]
      .breakdown,
  ).toContainEqual({ label: "Continue an unfinished story", points: 22 });
});
