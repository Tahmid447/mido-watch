"use client";
import { useState } from "react";
import Link from "next/link";
import { type Title, statusLabels } from "@/lib/model";
import { themes, titleThemes, auditMatches } from "@/lib/tonight";
import { priorityLabel } from "@/lib/priority";
import { Artwork } from "./artwork";
import { Providers } from "./evidence";
import { Trailer } from "./trailer";
import { AuditControls } from "./audit-controls";
const filters = [
  "All titles",
  "Need confirmation",
  "High priority",
  "Watched",
  "Not watched",
  ...themes,
] as const;
export function WatchAudit({ titles }: { titles: Title[] }) {
  const [filter, setFilter] = useState("Need confirmation"),
    [query, setQuery] = useState("");
  const shown = titles.filter(
    (t) =>
      auditMatches(t, filter) &&
      t.title.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="audit-toolbar">
        <label className="field">
          <span>Find a title</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your collection"
          />
        </label>
        <div
          className="filter-chips"
          role="group"
          aria-label="Watch Audit filters"
        >
          {filters.map((f) => (
            <button
              key={f}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <p className="small" aria-live="polite">
        {shown.length} titles · Unsure keeps your saved status and flags it for
        a later check.
      </p>
      {!shown.length && (
        <div className="inbox-empty">
          <h2>
            {filter === "Need confirmation"
              ? "No open confirmations."
              : "No titles match this view."}
          </h2>
          <p>
            Browse all titles to check anything you don’t remember watching.
          </p>
          <button className="button" onClick={() => setFilter("All titles")}>
            Show all titles
          </button>
        </div>
      )}
      <div className="audit-grid">
        {shown.map((t) => (
          <article key={t.id} className="audit-card">
            <div className="audit-card-top">
              <Link
                href={`/titles/${t.id}`}
                className="audit-poster"
                aria-label={`Open ${t.title}`}
              >
                <Artwork
                  path={t.metadata.poster_path}
                  url={t.poster_url}
                  title={t.title}
                />
              </Link>
              <div className="audit-copy">
                <p className="eyebrow">
                  {t.media_type} · {t.release_year ?? "Year unconfirmed"}
                </p>
                <h2>
                  <Link href={`/titles/${t.id}`}>{t.title}</Link>
                </h2>
                <div className="audit-facts">
                  {titleThemes(t)[0] ||
                    t.metadata.genres[0] ||
                    "Theme unconfirmed"}{" "}
                  ·{" "}
                  {t.metadata.runtime_minutes
                    ? `${t.metadata.runtime_minutes} min`
                    : t.metadata.episode_count
                      ? `${t.metadata.episode_count} episodes`
                      : "Length unconfirmed"}
                </div>
                <div className="detail-badges">
                  <span className={`badge status-${t.watch.status}`}>
                    {statusLabels[t.watch.status]}
                  </span>
                  {t.watch.confirmation_needed && (
                    <span className="badge">Needs confirmation</span>
                  )}
                  {t.watch.rating && (
                    <span className="personal-rating">
                      My rating <strong>{t.watch.rating}/10</strong>
                    </span>
                  )}
                </div>
                <span className="pick-level">
                  {priorityLabel(
                    t.recommendation?.priority ?? t.watch.priority,
                  )}
                </span>
                <p className="audit-reason">
                  <strong>Why it fits</strong>{" "}
                  {t.recommendation?.fit ||
                    t.recommendation?.reason ||
                    "Part of your own shortlist. Open the title to review its story and evidence."}
                </p>
                <p className="small">
                  <strong>Main caveat</strong>{" "}
                  {t.recommendation?.caveat ||
                    "No specific caveat recorded. Check the trailer before committing."}
                </p>
                {t.watch.notes && (
                  <p className="audit-note">
                    <strong>Your reaction:</strong> {t.watch.notes}
                  </p>
                )}
                <Providers title={t} compact />
                <div className="hero-actions">
                  <Trailer trailer={t.metadata.trailer} title={t.title} />
                  <Link className="small" href={`/titles/${t.id}`}>
                    Journal & evidence ↗
                  </Link>
                </div>
              </div>
            </div>
            <AuditControls title={t} />
            {t.media_type === "series" && (
              <details className="audit-seasons">
                <summary>
                  Independent seasons · {t.seasons.length} tracked
                </summary>
                {t.seasons.length ? (
                  t.seasons.map((s) => (
                    <div className="audit-season" key={s.number}>
                      <h3>
                        Season {s.number}{" "}
                        <span className="small">
                          {statusLabels[s.status]}
                          {s.rating && ` · My rating ${s.rating}/10`}
                          {s.rank && ` · Your #${s.rank}`}
                        </span>
                      </h3>
                      {s.notes && <p className="small">{s.notes}</p>}
                      <AuditControls title={t} season={s} />
                    </div>
                  ))
                ) : (
                  <p className="small">
                    No seasons tracked yet. Add one from the title’s journal.
                  </p>
                )}
              </details>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
