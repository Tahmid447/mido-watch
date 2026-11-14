import type { Title } from "./model";
export const themes = [
  "Spy / intelligence",
  "Police investigation",
  "Military",
  "Indian regional",
  "Japanese",
  "Psychological mystery",
  "Horror / supernatural",
  "Emotional drama",
] as const;
export type Theme = (typeof themes)[number];
const terms: Record<Theme, string[]> = {
  "Spy / intelligence": [
    "spy",
    "espionage",
    "intelligence",
    "undercover",
    "fbi",
    "cia",
    "mi5",
    "mi6",
    "conspiracy",
  ],
  "Police investigation": [
    "police",
    "cid",
    "detective",
    "investigat",
    "procedural",
    "interrogation",
    "evidence gathering",
  ],
  Military: [
    "military",
    "army",
    "navy",
    "soldier",
    "special forces",
    "combat",
    "veteran",
  ],
  "Indian regional": [
    "india",
    "indian",
    "malayalam",
    "tamil",
    "telugu",
    "kannada",
    "hindi",
    "bengali",
  ],
  Japanese: ["japan", "japanese", "ja"],
  "Psychological mystery": [
    "mystery",
    "psychological",
    "cat-and-mouse",
    "suspense",
    "clever",
    "strategic",
  ],
  "Horror / supernatural": ["horror", "supernatural", "paranormal", "haunted"],
  "Emotional drama": [
    "drama",
    "emotional",
    "relationship",
    "family",
    "romance",
  ],
};
function containsTerm(text: string, term: string) {
  return ["cia", "cid", "fbi", "mi5", "mi6"].includes(term)
    ? new RegExp("\\b" + term + "\\b").test(text)
    : text.includes(term);
}
const languageNames: Record<string, string> = {
  ml: "Malayalam",
  ta: "Tamil",
  te: "Telugu",
  kn: "Kannada",
  hi: "Hindi",
  bn: "Bengali",
  ja: "Japanese",
};
// Personal reactions are deliberately excluded from descriptions: a disliked trait is not a genre.
export function descriptor(t: Title) {
  return [
    t.title,
    t.synopsis,
    t.country,
    t.metadata.original_language,
    languageNames[t.metadata.original_language],
    ...t.tags,
    ...t.metadata.genres,
    t.recommendation?.reason,
    t.recommendation?.fit,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
export function titleThemes(t: Title): Theme[] {
  const d = descriptor(t);
  return themes.filter((theme) =>
    terms[theme].some((word) =>
      word === "ja"
        ? t.metadata.original_language === "ja"
        : containsTerm(d, word),
    ),
  );
}
export const timeOptions = [
  "Under 2 hours",
  "One or two episodes",
  "Long session",
] as const;
export const moodOptions = [
  "Spy / intelligence",
  "Police investigation",
  "Military action",
  "Clever mystery",
  "Indian thriller",
  "Japanese mystery",
  "Emotional drama",
  "Horror, but only with a strong mystery",
] as const;
export type TonightOptions = {
  time: (typeof timeOptions)[number];
  mood: (typeof moodOptions)[number];
  intensity: "Any" | "Measured" | "High";
  format: "Either" | "Movie" | "Series";
};
export type TasteSignal = { signal: string; weight: number; notes: string };
const moodTheme: Record<TonightOptions["mood"], Theme> = {
  "Spy / intelligence": "Spy / intelligence",
  "Police investigation": "Police investigation",
  "Military action": "Military",
  "Clever mystery": "Psychological mystery",
  "Indian thriller": "Indian regional",
  "Japanese mystery": "Japanese",
  "Emotional drama": "Emotional drama",
  "Horror, but only with a strong mystery": "Horror / supernatural",
};
export type TonightPick = {
  title: Title;
  score: number;
  reasons: string[];
  caveats: string[];
  breakdown: { label: string; points: number }[];
};
function signalTerms(signal: string) {
  return signal
    .toLowerCase()
    .split(/\s*\/\s*|\s+and\s+|\s*&\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}
function knownTrait(d: string, signal: string) {
  const needles = signalTerms(signal);
  return (
    needles.some((n) => containsTerm(d, n)) ||
    (/implausib|impossible|cartoon|plot armor/.test(signal) &&
      /implausib|impossible schemes|cartoonish|plot armor/.test(d)) ||
    (/pure horror/.test(signal) && /pure horror/.test(d))
  );
}
export function rankTonight(
  titles: Title[],
  taste: TasteSignal[],
  options: TonightOptions,
  region = "JP",
): TonightPick[] {
  return titles
    .filter(
      (t) =>
        !["watched", "skip"].includes(t.watch.status) &&
        t.recommendation?.state !== "dismissed",
    )
    .flatMap((t) => {
      const d = descriptor(t),
        ts = titleThemes(t),
        isHorror = ts.includes("Horror / supernatural"),
        hasMystery = ts.some((x) =>
          [
            "Police investigation",
            "Psychological mystery",
            "Spy / intelligence",
          ].includes(x),
        );
      const exceptional = t.reviews.some(
        (r) =>
          r.verified &&
          r.source.toLowerCase() === "tmdb" &&
          r.vote_count !== null &&
          r.vote_count >= 100 &&
          Number.parseFloat(r.score ?? "") >= 8,
      );
      const coherent =
        /internally coherent|coherent (?:supernatural )?rules/.test(d);
      if (isHorror && !hasMystery && !exceptional && !coherent) return [];
      if (
        options.format !== "Either" &&
        t.media_type !== (options.format === "Movie" ? "movie" : "series")
      )
        return [];
      if (
        options.time === "Under 2 hours" &&
        t.media_type === "movie" &&
        t.metadata.runtime_minutes !== null &&
        t.metadata.runtime_minutes >= 120
      )
        return [];
      const breakdown: { label: string; points: number }[] = [],
        reasons: string[] = [],
        caveats: string[] = [];
      const add = (label: string, points: number) =>
        breakdown.push({ label, points });
      add(
        "Your recommendation level",
        Math.round((t.recommendation?.priority ?? t.watch.priority) * 0.2),
      );
      if (
        t.watch.status === "watching" ||
        t.seasons.some((s) => s.status === "watching")
      ) {
        add("Continue an unfinished story", 22);
        reasons.push("You already started this story.");
      }
      if (
        t.watch.confirmation_needed ||
        t.seasons.some((s) => s.confirmation_needed)
      ) {
        add("Watch status needs confirmation", -15);
        caveats.push("Confirm where you left off before starting.");
      }
      const moodFits =
        options.mood === "Japanese mystery"
          ? ts.includes("Japanese") && hasMystery
          : options.mood === "Indian thriller"
            ? ts.includes("Indian regional") &&
              /thriller|crime|investigat|suspense|mystery/.test(d)
            : options.mood === "Horror, but only with a strong mystery"
              ? isHorror && hasMystery
              : ts.includes(moodTheme[options.mood]);
      if (moodFits) {
        add("Your mood tonight", 28);
        reasons.push(`Matches ${options.mood.toLowerCase()}.`);
      }
      if (options.time === "One or two episodes") {
        add("Episode-sized session", t.media_type === "series" ? 18 : -12);
        if (t.media_type === "series")
          reasons.push("A series fits your one- or two-episode session.");
      }
      if (options.time === "Under 2 hours") {
        if (t.media_type === "movie") {
          if (t.metadata.runtime_minutes !== null) {
            add("Known runtime fits", 18);
            reasons.push(
              `${t.metadata.runtime_minutes} minutes fits your time window.`,
            );
          } else {
            add("Runtime unknown", -10);
            caveats.push(
              "Runtime is not confirmed; check it before committing.",
            );
          }
        } else {
          add("An episode rather than the full series", 4);
          caveats.push(
            "Episode runtime is not verified; the full series will not fit this window.",
          );
        }
      }
      const providers = t.availability.filter(
        (a) =>
          a.region === region &&
          (a.origin === "tmdb" || a.verified_on !== null),
      );
      if (providers.length) {
        add("Sourced availability in your region", 10);
        reasons.push(
          `Listed in ${region} by ${[...new Set(providers.map((a) => a.provider))].slice(0, 2).join(" / ")}.`,
        );
      } else {
        add("Regional availability unconfirmed", -4);
        caveats.push(`Availability in ${region} is not confirmed.`);
      }
      const evidence = [
        d,
        t.recommendation?.caveat,
        ...t.reviews.filter((r) => r.verified).map((r) => r.notes),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      let positive = 0,
        negative = 0;
      for (const s of taste) {
        if (knownTrait(s.weight < 0 ? evidence : d, s.signal)) {
          const points =
            s.weight > 0 ? Math.min(8, s.weight * 2) : s.weight * 5;
          if (points > 0) positive += points;
          else {
            negative += points;
            caveats.push(
              `Potential mismatch with your preference against ${s.signal}.`,
            );
          }
        }
      }
      if (positive) {
        add("Matching recorded preferences", Math.min(positive, 30));
        reasons.push("Its described themes match your recorded taste signals.");
      }
      if (negative) add("Known disliked traits", Math.max(negative, -60));
      if (options.intensity !== "Any") {
        const high = /action|combat|violent|high.intensity|fast.paced/.test(d);
        add(
          "Intensity preference",
          options.intensity === "High" ? (high ? 6 : 0) : high ? -8 : 4,
        );
        if (options.intensity === "Measured" && high)
          caveats.push("The description suggests a more intense watch.");
      }
      if (t.recommendation?.caveat) caveats.unshift(t.recommendation.caveat);
      if (!t.recommendation?.caveat && !caveats.length)
        caveats.push(
          "No specific caveat is recorded; check the synopsis and trailer.",
        );
      return [
        {
          title: t,
          score: breakdown.reduce((n, b) => n + b.points, 0),
          reasons,
          caveats: [...new Set(caveats)],
          breakdown,
        },
      ];
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.title.title.localeCompare(b.title.title) ||
        a.title.id.localeCompare(b.title.id),
    );
}
export function auditMatches(t: Title, filter: string) {
  if (filter === "Need confirmation")
    return (
      t.watch.confirmation_needed ||
      t.seasons.some((s) => s.confirmation_needed)
    );
  if (filter === "High priority")
    return (
      !["watched", "skip"].includes(t.watch.status) &&
      (t.recommendation?.priority ?? t.watch.priority) >= 75
    );
  if (filter === "Watched") return t.watch.status === "watched";
  if (filter === "Not watched")
    return ["not-watched", "interested"].includes(t.watch.status);
  return filter === "All titles" || titleThemes(t).includes(filter as Theme);
}
