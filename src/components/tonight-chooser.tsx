"use client";
import { useState } from "react";
import Link from "next/link";
import type { Title } from "@/lib/model";
import {
  rankTonight,
  timeOptions,
  moodOptions,
  type TonightOptions,
  type TasteSignal,
} from "@/lib/tonight";
import { priorityLabel } from "@/lib/priority";
import { Artwork } from "./artwork";
import { Providers } from "./evidence";
import { Trailer } from "./trailer";
export function TonightChooser({
  titles,
  taste,
  region = "JP",
}: {
  titles: Title[];
  taste: TasteSignal[];
  region?: string;
}) {
  const [options, setOptions] = useState<TonightOptions>({
    time: "One or two episodes",
    mood: "Spy / intelligence",
    intensity: "Any",
    format: "Either",
  });
  const ranked = rankTonight(titles, taste, options, region),
    pick = ranked[0],
    t = pick?.title;
  return (
    <section className="tonight-picker">
      <div className="section-heading">
        <div>
          <p className="eyebrow gold">A LITTLE DIRECTION</p>
          <h2>What should I watch tonight?</h2>
        </div>
        <Link href="/plan">Open my plan ↗</Link>
      </div>
      <div className="tonight-filters">
        <label className="field">
          <span>Available time</span>
          <select
            value={options.time}
            onChange={(e) =>
              setOptions({
                ...options,
                time: e.target.value as TonightOptions["time"],
              })
            }
          >
            {timeOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Mood</span>
          <select
            value={options.mood}
            onChange={(e) =>
              setOptions({
                ...options,
                mood: e.target.value as TonightOptions["mood"],
              })
            }
          >
            {moodOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Movie or series?</span>
          <select
            value={options.format}
            onChange={(e) =>
              setOptions({
                ...options,
                format: e.target.value as TonightOptions["format"],
              })
            }
          >
            {["Either", "Movie", "Series"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Intensity</span>
          <select
            value={options.intensity}
            onChange={(e) =>
              setOptions({
                ...options,
                intensity: e.target.value as TonightOptions["intensity"],
              })
            }
          >
            {["Any", "Measured", "High"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      {t ? (
        <>
          <section className="cinema-hero">
            <div className="hero-background">
              <Artwork
                path={t.metadata.backdrop_path || t.metadata.poster_path}
                url={t.poster_url}
                title={t.title}
                backdrop
                eager
              />
            </div>
            <div className="cinema-hero-copy">
              <p className="eyebrow gold">
                TONIGHT’S CHOICE ·{" "}
                {priorityLabel(t.recommendation?.priority ?? t.watch.priority)}
              </p>
              <h2>{t.title}</h2>
              <p>
                {pick.reasons.join(" ") ||
                  "The strongest remaining fit among your recorded picks."}
              </p>
              <div className="tonight-caveat">
                <strong>Main caveat</strong>
                <p>{pick.caveats[0]}</p>
              </div>
              <Providers title={t} compact />
              <div className="hero-actions">
                <Link href={`/titles/${t.id}`} className="button primary">
                  Open this title ↗
                </Link>
                <Trailer trailer={t.metadata.trailer} title={t.title} />
              </div>
            </div>
          </section>
          <details className="scoring-explanation">
            <summary>Why this choice?</summary>
            <p className="small">
              Transparent rules using your saved status, taste weights, time,
              mood and sourced availability. This is not machine learning.
              Unknown traits are not assumed; descriptions cannot prove a plot
              is realistic.
            </p>
            {pick.breakdown.map((b) => (
              <p className="small" key={b.label}>
                {b.label}{" "}
                <strong>
                  {b.points > 0 ? "+" : ""}
                  {b.points}
                </strong>
              </p>
            ))}
            {pick.caveats.slice(1).map((c, i) => (
              <p className="small" key={i}>
                {c}
              </p>
            ))}
            {ranked.length > 1 && (
              <p className="small">
                Other fits:{" "}
                {ranked
                  .slice(1, 3)
                  .map((p) => p.title.title)
                  .join(" · ")}
              </p>
            )}
          </details>
        </>
      ) : (
        <div className="inbox-empty">
          <h3>No suitable unwatched pick for these choices.</h3>
          <p>
            Try another mood or time window, or confirm your history in Watch
            Audit.
          </p>
          <Link href="/audit" className="button">
            Open Watch Audit
          </Link>
        </div>
      )}
    </section>
  );
}
