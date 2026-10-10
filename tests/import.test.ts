import { describe, it, expect } from "vitest";
import { parseImport } from "../src/lib/import";
import { titleSchema } from "../src/lib/model";
import seed from "../src/lib/v1-seed.json";
describe("V1 migration", () => {
  it("preserves all original entries and consolidates seasons", () => {
    const b = parseImport(seed, true);
    expect(seed.titles).toHaveLength(47);
    expect(b.titles).toHaveLength(44);
    expect(b.titles.reduce((n, t) => n + t.seasons.length, 0)).toBe(6);
    const r = b.titles.find((t) => t.title === "Reacher")!;
    expect(
      r.seasons
        .sort((a, b) => a.number - b.number)
        .map((s) => [s.status, s.rank]),
    ).toEqual([
      ["watched", 2],
      ["watched", 1],
      ["watched", 3],
      ["not-watched", null],
    ]);
    expect(
      b.titles
        .find((t) => t.title === "Paatal Lok")!
        .seasons.map((s) => s.status),
    ).toEqual(["watched", "watched"]);
    expect(
      b.titles.find((t) => t.title.startsWith("1122"))!.watch.notes,
    ).toContain("liked");
  });
  it("marks legacy external reviews and platform claims unverified", () => {
    for (const t of parseImport(seed, true).titles) {
      expect(
        t.reviews.every((r) => !r.verified && r.captured_on === null),
      ).toBe(true);
      expect(t.availability.every((a) => a.verified_on === null)).toBe(true);
      expect(t.watch.rating).toBeNull();
    }
  });
  it("honors user-edited V1 season statuses without injecting seed opinions", () => {
    const b = parseImport([
      {
        title: "Reacher — Season 4",
        type: "Series",
        status: "watched",
        note: "My new note",
      },
    ]);
    expect(b.titles[0].seasons[0].status).toBe("watched");
    expect(b.titles[0].seasons[0].rank).toBeNull();
  });
  it("round-trips V2 backups", () => {
    const b = parseImport(seed, true);
    expect(parseImport(JSON.parse(JSON.stringify(b)))).toEqual(b);
  });
  it("rejects invalid, duplicate, and dangerous imported values", () => {
    expect(() => parseImport({ titles: [{ title: "Oops" }] })).toThrow();
    expect(() => parseImport({ version: 3, titles: [] })).toThrow();
    expect(() => parseImport([seed.titles[0], seed.titles[0]])).toThrow();
    expect(() =>
      titleSchema.parse({
        title: "Bad",
        media_type: "movie",
        poster_url: "javascript:alert(1)",
      }),
    ).toThrow();
  });
});
