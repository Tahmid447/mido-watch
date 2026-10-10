import Link from "next/link";
import { notFound } from "next/navigation";
import { titleById } from "@/lib/data";
import { statusLabels } from "@/lib/model";
import {
  WatchEditor,
  SeasonEditor,
  MetadataEditor,
  RecommendationEditor,
  EvidenceEditors,
} from "@/components/title-editors";
export default async function Detail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await titleById((await params).id);
  if (!t) notFound();
  return (
    <>
      <Link className="back-link" href="/library">
        ← Your collection
      </Link>
      <div className="detail-heading">
        <div className="detail-poster tone-1">
          {t.poster_url ? (
            <img src={t.poster_url} alt={`${t.title} poster`} />
          ) : (
            <span>{t.title}</span>
          )}
        </div>
        <div>
          <p className="eyebrow gold">
            {t.media_type} · {t.country || "COUNTRY UNKNOWN"}{" "}
            {t.release_year && `· ${t.release_year}`}
          </p>
          <h1>{t.title}</h1>
          <span className={`badge status-${t.watch.status}`}>
            {statusLabels[t.watch.status]}
          </span>
          {t.watch.rating && (
            <span className="badge">Your rating {t.watch.rating}/10</span>
          )}
          <p>
            {t.synopsis ||
              "Your story with this title starts here. Add a synopsis in metadata."}
          </p>
          <div className="tags">
            {t.tags.map((tag) => (
              <Link
                className="badge"
                href={`/library?tag=${encodeURIComponent(tag)}`}
                key={tag}
              >
                {tag}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="detail-columns">
        <div>
          <section className="panel">
            <p className="eyebrow gold">YOUR POINT OF VIEW</p>
            <h2>Watch journal</h2>
            <WatchEditor t={t} />
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
              {t.seasons
                .sort((a, b) => a.number - b.number)
                .map((s) => (
                  <SeasonEditor key={s.number} t={t} s={s} />
                ))}
              <SeasonEditor t={t} />
            </section>
          )}
          <MetadataEditor t={t} />
        </div>
        <div>
          {t.recommendation && (
            <section className="panel">
              <p className="eyebrow gold">WHY THIS ONE</p>
              <h2>{t.recommendation.reason}</h2>
              <p>{t.recommendation.fit}</p>
              <p>
                <strong>Main caveat</strong>
                <br />
                {t.recommendation.caveat || "Not recorded."}
              </p>
              <p>{t.recommendation.availability_note}</p>
              <p className="small">
                {t.recommendation.source} · {t.recommendation.recommended_on} ·{" "}
                {t.recommendation.state}
              </p>
            </section>
          )}
          <RecommendationEditor t={t} />
          <section className="panel">
            <h2>Where to watch</h2>
            {t.availability.length ? (
              t.availability.map((a, i) => (
                <div className="evidence" key={i}>
                  <strong>{a.provider}</strong>
                  <span className="badge">
                    {a.region === "ZZ" ? "Region unknown" : a.region} · {a.kind}
                  </span>
                  <p>{a.notes}</p>
                  <p className="small">
                    Release: {a.release_on || "Unknown"} · OTT:{" "}
                    {a.ott_on || "Unknown"} · Cinema:{" "}
                    {a.theatrical_on || "Unknown"}
                  </p>
                  <p className="small">
                    {a.verified_on
                      ? `Verified ${a.verified_on}`
                      : "Unverified availability"}{" "}
                    {a.source_url && (
                      <a href={a.source_url} rel="noreferrer" target="_blank">
                        Source ↗
                      </a>
                    )}
                  </p>
                </div>
              ))
            ) : (
              <p>
                No availability evidence yet. Japan availability is unknown.
              </p>
            )}
          </section>
          <section className="panel">
            <h2>Review evidence</h2>
            <p className="small">
              Source scores stay separate from your rating. Different scales are
              never averaged.
            </p>
            {t.reviews.length ? (
              t.reviews.map((r, i) => (
                <div className="evidence" key={i}>
                  <strong>{r.source}</strong>
                  <span className="review-score">
                    {r.score ?? "No score"} <small>{r.score_type}</small>
                  </span>
                  {r.critic_score && <p>Critics: {r.critic_score}</p>}
                  {r.audience_score && <p>Audience: {r.audience_score}</p>}
                  {r.vote_count !== null && (
                    <p>{r.vote_count} votes / reviews</p>
                  )}
                  <p className="small">
                    {r.verified ? "Verified" : "Unverified"} ·{" "}
                    {r.captured_on || "Capture date unknown"}{" "}
                    {r.source_url && (
                      <a href={r.source_url} rel="noreferrer" target="_blank">
                        Source ↗
                      </a>
                    )}
                  </p>
                  <p className="small">{r.notes}</p>
                </div>
              ))
            ) : (
              <p>No external review evidence recorded.</p>
            )}
          </section>
          <EvidenceEditors t={t} />
        </div>
      </div>
    </>
  );
}
