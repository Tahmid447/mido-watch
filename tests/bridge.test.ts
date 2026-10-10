import { describe, it, expect } from "vitest";
import { titleSchema, backupSchema } from "../src/lib/model";
import { selectMatch, normalizedTitle } from "../src/lib/metadata-matching";
import {
  matchPack,
  recommendationPackSchema,
  chatgptContext,
} from "../src/lib/recommendation-pack";
import { priorityLabel } from "../src/lib/priority";
import { imageUrl } from "../src/lib/artwork";
const candidate = (id: number, year = 2022, countries = ["US"]) => ({
  id,
  title: "Reacher",
  original_title: "Reacher",
  year,
  countries,
  poster_path: null,
  overview: "",
});
const title = () => ({
  ...titleSchema.parse({
    title: "Reacher",
    media_type: "series",
    release_year: 2022,
    country: "USA",
    tmdb_id: 108978,
    watch: { rating: 9, notes: "Competent hero", favorite: true },
    seasons: [
      { number: 2, status: "watched", rank: 1, notes: "Loved this season" },
    ],
  }),
  id: "11111111-1111-4111-8111-111111111111",
  updated_at: "private timestamp",
});
const pack = (extra = {}) =>
  recommendationPackSchema.parse({
    schema_version: 1,
    generated_at: "2026-10-09T09:00:00Z",
    recommendations: [
      {
        title: "Reacher",
        media_type: "series",
        release_year: 2022,
        country: "USA",
        priority: 95,
        reason: "Good fit",
        ...extra,
      },
    ],
  });
describe("Conservative metadata identity", () => {
  it("matches exact title/year/territory, refusing remakes and competing editions", () => {
    const t = title();
    expect(selectMatch(t, [candidate(1)]).state).toBe("matched");
    expect(selectMatch(t, [candidate(1), candidate(2)]).state).toBe(
      "needs-review",
    );
    expect(selectMatch(t, [candidate(1, 2023)]).state).toBe("needs-review");
    expect(selectMatch(t, [candidate(1, 2022, ["IN"])]).state).toBe(
      "needs-review",
    );
    expect(selectMatch(t, []).state).toBe("no-result");
  });
  it("does not auto-match names without independent evidence", () => {
    expect(
      selectMatch({ ...title(), country: "", release_year: null }, [
        candidate(1),
      ]).match,
    ).toBeNull();
    expect(normalizedTitle("The Night Manager (UK)")).toBe("the night manager");
  });
});
describe("Recommendation packs", () => {
  it("validates evidence and rejects personal-data overwrite fields, duplicate entries and invalid times", () => {
    expect(() => pack({ watch: { rating: 1 } })).toThrow();
    expect(() =>
      pack({ reviews: [{ source: "IMDb", verified: true }] }),
    ).toThrow();
    const p = pack();
    expect(
      recommendationPackSchema.safeParse({
        ...p,
        recommendations: [...p.recommendations, ...p.recommendations],
      }).success,
    ).toBe(false);
    expect(
      recommendationPackSchema.safeParse({ ...p, generated_at: "Friday" })
        .success,
    ).toBe(false);
  });
  it("uses IDs, conservatively resolves identity, and flags contradictory IDs", () => {
    expect(matchPack(pack({ tmdb_id: 108978 }), [title()])[0].kind).toBe(
      "matched",
    );
    expect(
      matchPack(pack(), [title(), { ...title(), id: "second" }])[0].kind,
    ).toBe("ambiguous");
    expect(matchPack(pack({ tmdb_id: 1234 }), [title()])[0].kind).toBe(
      "ambiguous",
    );
    expect(matchPack(pack({ title: "Unknown" }), [title()])[0].kind).toBe(
      "new",
    );
  });
  it("exports compact useful context without internal IDs, credentials or bulky artwork", () => {
    const context = chatgptContext(
      backupSchema.parse({
        version: 2,
        titles: [title()],
        taste: [{ signal: "spy", weight: 5, notes: "" }],
      }),
    );
    expect(context.titles[0]).toMatchObject({
      rating: 9,
      notes: "Competent hero",
      favorite: true,
      seasons: [{ rank: 1, notes: "Loved this season" }],
    });
    const json = JSON.stringify(context);
    for (const privateField of [
      "user_id",
      "updated_at",
      "poster_path",
      "private timestamp",
      "11111111-",
    ])
      expect(json).not.toContain(privateField);
  });
});
it("maps every priority boundary and rejects unsafe artwork paths", () => {
  expect([0, 29, 30, 54, 55, 74, 75, 89, 90, 100].map(priorityLabel)).toEqual([
    "Low Priority",
    "Low Priority",
    "Maybe",
    "Maybe",
    "Worth Watching",
    "Worth Watching",
    "Strong Pick",
    "Strong Pick",
    "Must Watch",
    "Must Watch",
  ]);
  expect(imageUrl(null, "w500")).toBeNull();
  expect(imageUrl("https://evil.example/x", "w500")).toBeNull();
  expect(imageUrl("/poster.jpg", "w500")).toBe(
    "https://image.tmdb.org/t/p/w500/poster.jpg",
  );
});

it("resolves a bilingual parenthetical alias conservatively", () => {
  const t = {
    ...title(),
    title: "Exit 8 (8番出口)",
    release_year: null,
    country: "Japan",
    media_type: "movie" as const,
  };
  expect(
    selectMatch(t, [
      {
        ...candidate(1, 2025, ["JP"]),
        title: "Exit 8",
        original_title: "8番出口",
      },
    ]).state,
  ).toBe("matched");
});
