import Link from "next/link";
import { notFound } from "next/navigation";
import { titleById, profile } from "@/lib/data";
import { statusLabels } from "@/lib/model";
import { priorityLabel } from "@/lib/priority";
import {
  WatchEditor,
  SeasonEditor,
  MetadataEditor,
  RecommendationEditor,
  EvidenceEditors,
} from "@/components/title-editors";
import { Artwork } from "@/components/artwork";
import { Trailer } from "@/components/trailer";
import { Providers, Reviews } from "@/components/evidence";
import { QuickActions } from "@/components/title-card";
import { ActionForm } from "@/components/forms";
import { refreshMetadata } from "@/app/bridge-actions";
export default async function Detail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [t, p] = await Promise.all([titleById((await params).id), profile()]);
  if (!t) notFound();
  const m = t.metadata,
    r = t.recommendation;
  return (
    <>
      <Link className="back-link" href="/library">
        ← Your collection
      </Link>
      <section className="detail-hero">
        <div className="hero-background">
          <Artwork
            path={m.backdrop_path}
            url={m.backdrop_path ? null : t.poster_url}
            title={t.title}
            backdrop
            eager
          />
        </div>
        <div className="detail-hero-content">
          <div className="detail-hero-poster">
            <Artwork
              path={m.poster_path}
              url={t.poster_url}
              title={t.title}
              eager
            />
          </div>
          <div className="detail-hero-copy">
            <p className="eyebrow gold">
              {t.media_type} · {t.release_year} ·{" "}
              {t.country || m.original_language.toUpperCase()}
            </p>
            <h1>{t.title}</h1>
            {t.original_title && t.original_title !== t.title && (
              <p className="original-title">{t.original_title}</p>
            )}
            <div className="detail-facts">
              {m.genres.join(" · ")}
              {m.runtime_minutes && ` · ${m.runtime_minutes} min`}
              {m.episode_count && ` · ${m.episode_count} episodes`}
            </div>
            <div className="detail-badges">
              <span className={`badge status-${t.watch.status}`}>
                {statusLabels[t.watch.status]}
              </span>
              <span className="pick-level">
                {priorityLabel(r?.priority ?? t.watch.priority)}
              </span>
              {t.watch.rating && (
                <span className="personal-rating">
                  Your rating <strong>{t.watch.rating}/10</strong>
                </span>
              )}
              {t.watch.favorite && <span className="badge">★ Favorite</span>}
            </div>
            {t.synopsis && <p className="hero-synopsis">{t.synopsis}</p>}
            <div className="hero-actions">
              <Trailer trailer={m.trailer} title={t.title} />
              <QuickActions title={t} />
              <a className="button primary" href="#journal">
                Your journal ↓
              </a>
            </div>
          </div>
        </div>
      </section>
      {r && (
        <section className="why-fit">
          <div>
            <p className="eyebrow gold">WHY THIS FITS YOU</p>
            <h2>{r.reason}</h2>
            {r.fit && <p>{r.fit}</p>}
          </div>
          {r.caveat && (
            <div className="caveat">
              <p className="eyebrow">MAIN CAVEAT</p>
              <p>{r.caveat}</p>
            </div>
          )}
        </section>
      )}
      <div className="detail-columns">
        <div>
          <section className="panel" id="journal">
            <p className="eyebrow gold">YOUR POINT OF VIEW</p>
            <h2>Watch journal</h2>
            <div className="journal-summary">
              <span className={`badge status-${t.watch.status}`}>
                {statusLabels[t.watch.status]}
              </span>
              {t.watch.rating && (
                <strong>Your personal rating · {t.watch.rating}/10</strong>
              )}
            </div>
            {t.watch.notes && <p className="journal-notes">{t.watch.notes}</p>}
            <details className="journal-editor">
              <summary>Edit your journal</summary>
              <WatchEditor t={t} />
            </details>
          </section>
          {t.media_type === "series" && (
            <section className="panel">
              <p className="eyebrow gold">ONE SEASON AT A TIME</p>
              <h2>Season journal</h2>
              <p className="small">
                {t.seasons.filter((s) => s.status === "watched").length} of{" "}
                {t.seasons.length} tracked seasons watched. Series status is
                your overall choice.
              </p>
              <div
                className="season-progress"
                role="img"
                aria-label={`${t.seasons.filter((s) => s.status === "watched").length} of ${t.seasons.length} seasons watched`}
              >
                {t.seasons.map((s) => (
                  <span
                    key={s.number}
                    className={s.status}
                    title={`Season ${s.number}: ${statusLabels[s.status]}`}
                  />
                ))}
              </div>
              {t.seasons
                .toSorted((a, b) => a.number - b.number)
                .map((s) => (
                  <div key={s.number}>
                    <SeasonEditor t={t} s={s} />
                    {m.season_info.find((i) => i.number === s.number) && (
                      <p className="small season-info">
                        {
                          m.season_info.find((i) => i.number === s.number)
                            ?.episode_count
                        }{" "}
                        episodes ·{" "}
                        {m.season_info.find((i) => i.number === s.number)
                          ?.air_date || "Air date unknown"}
                      </p>
                    )}
                  </div>
                ))}
              <SeasonEditor t={t} />
            </section>
          )}
          {t.reviews.length > 0 && (
            <section className="panel">
              <p className="eyebrow gold">OTHER POINTS OF VIEW</p>
              <h2>External reviews & ratings</h2>
              <p className="small">
                Each source keeps its own scale. Your personal rating belongs in
                your journal.
              </p>
              <Reviews title={t} />
            </section>
          )}
        </div>
        <div>
          {t.availability.length > 0 && (
            <section className="panel">
              <p className="eyebrow gold">YOUR REGION · {p.region}</p>
              <h2>Where to watch</h2>
              <Providers title={t} />
            </section>
          )}
          {!t.availability.some((a) => a.region === p.region) && (
            <p className="small availability-unknown">
              Availability in {p.region} is not confirmed.{" "}
              <Link href="/settings/metadata">Refresh metadata ↗</Link>
            </p>
          )}
          {m.release_date && (
            <section className="panel">
              <h2>Release information</h2>
              <p>
                Original release · <strong>{m.release_date}</strong>
              </p>
              <p className="small">
                TMDb release date. Regional streaming dates appear only when
                recorded with evidence.
              </p>
            </section>
          )}
          {r && (
            <section className="panel">
              <h2>Recommendation history</h2>
              <p className="small">
                {r.source} · {r.recommended_on} · {r.state}
              </p>
              {r.runtime_or_episode_count && (
                <p>{r.runtime_or_episode_count}</p>
              )}
              {r.history.length > 0 && (
                <details>
                  <summary>{r.history.length} earlier recommendations</summary>
                  {r.history.toReversed().map((h, i) => (
                    <div className="evidence" key={i}>
                      <p className="small">
                        {h.source} · {h.generated_at.slice(0, 10)} ·{" "}
                        {priorityLabel(h.priority)}
                      </p>
                      <p>{h.reason}</p>
                      {h.caveat && <p className="small">{h.caveat}</p>}
                    </div>
                  ))}
                </details>
              )}
            </section>
          )}
          <section className="panel external-links">
            <h2>Title information</h2>
            <div className="tags">
              {[...m.genres, ...t.tags].map((tag) => (
                <span key={tag} className="badge">
                  {tag}
                </span>
              ))}
            </div>
            <p className="small">
              Metadata {m.state.replaceAll("-", " ")}
              {m.refreshed_at && ` · checked ${m.refreshed_at.slice(0, 10)}`}
            </p>
            <div className="hero-actions">
              {t.tmdb_id && (
                <a
                  href={`https://www.themoviedb.org/${t.media_type === "series" ? "tv" : "movie"}/${t.tmdb_id}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  TMDb ↗
                </a>
              )}
              {t.imdb_id && (
                <a
                  href={`https://www.imdb.com/title/${t.imdb_id}/`}
                  rel="noreferrer"
                  target="_blank"
                >
                  IMDb ↗
                </a>
              )}
              <Link href="/settings/metadata">Review metadata ↗</Link>
            </div>
            <ActionForm
              handler={refreshMetadata}
              titleId={t.id}
              submit="Refresh this title"
              className="quick"
            />
          </section>
          <RecommendationEditor t={t} />
          <MetadataEditor t={t} />
          <EvidenceEditors t={t} />
        </div>
      </div>
    </>
  );
}
