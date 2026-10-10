import type { TitleInput } from "./model";
export type Candidate = {
  id: number;
  title: string;
  original_title: string;
  year: number | null;
  countries: string[];
  poster_path: string | null;
  overview: string;
};
export function normalizedTitle(s: string) {
  return s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s*\((?:\d{4}|uk|us|india|japan|korea)\)\s*/gi, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}
export function countryCode(s: string) {
  const lower = s.toLowerCase();
  return (
    Object.entries({
      JP: ["japan", "japanese"],
      IN: ["india", "indian"],
      KR: ["korea", "korean", "south korea"],
      GB: ["uk", "united kingdom", "british"],
      US: ["usa", "us", "united states", "american"],
      ES: ["spain", "spanish"],
      DE: ["germany", "german"],
      FR: ["france", "french"],
      CN: ["china", "chinese"],
    }).find(
      ([code, names]) =>
        lower === code.toLowerCase() || names.some((n) => lower === n),
    )?.[0] ?? null
  );
}
export function selectMatch(
  t: Pick<TitleInput, "title" | "original_title" | "release_year" | "country">,
  candidates: Candidate[],
) {
  const names = [
    t.title,
    t.original_title,
    ...[...t.title.matchAll(/\(([^)]+)\)/g)].map((m) => m[1]),
    t.title.replace(/\s*\([^)]*\)/g, ""),
  ]
    .filter(Boolean)
    .map((s) => normalizedTitle(s!));
  const country = countryCode(t.country);
  const exact = candidates.filter(
    (c) =>
      [c.title, c.original_title].some((s) =>
        names.includes(normalizedTitle(s)),
      ) &&
      (t.release_year === null || c.year === t.release_year) &&
      (!country || c.countries.includes(country)),
  );
  // A year or known territory is required, and competing exact names stay in review.
  const strong = exact.length === 1 && (t.release_year !== null || !!country);
  return {
    state: strong
      ? "matched"
      : candidates.length
        ? "needs-review"
        : "no-result",
    match: strong ? exact[0] : null,
    candidates: candidates.slice(0, 12),
  } as const;
}
