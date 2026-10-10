import type { Title } from "@/lib/model";
import { imageUrl } from "@/lib/artwork";
export function Providers({
  title: t,
  compact = false,
}: {
  title: Title;
  compact?: boolean;
}) {
  const regional = t.availability.filter((a) => a.region === "JP");
  const preferred = regional.some((a) => a.origin === "tmdb")
    ? regional.filter((a) => a.origin === "tmdb")
    : regional;
  const all = compact
    ? preferred
        .filter((a) => a.region === "JP")
        .filter(
          (a, i, arr) => arr.findIndex((b) => b.provider === a.provider) === i,
        )
        .slice(0, 3)
    : t.availability;
  if (!all.length) return null;
  return (
    <div className={compact ? "provider-compact" : "providers"}>
      {all.map((a, i) => (
        <div className="provider" key={i}>
          {a.logo_path && (
            <img src={imageUrl(a.logo_path, "w92")!} alt="" loading="lazy" />
          )}
          {compact ? (
            <span>{a.provider}</span>
          ) : (
            <div>
              <strong>{a.provider}</strong>
              <span className="small">
                {a.region} · {a.kind}
              </span>
              <p className="small">
                {a.origin === "tmdb"
                  ? `Provider metadata · checked ${a.fetched_at?.slice(0, 10) || "recently"}`
                  : a.verified_on
                    ? `Evidence verified ${a.verified_on}`
                    : "Evidence not verified"}
                {a.source_url && (
                  <>
                    {" "}
                    ·{" "}
                    <a href={a.source_url} target="_blank" rel="noreferrer">
                      Check availability ↗
                    </a>
                  </>
                )}
              </p>
              {a.notes && a.origin !== "tmdb" && (
                <p className="small">{a.notes}</p>
              )}
              {[a.release_on, a.ott_on, a.theatrical_on].some(Boolean) && (
                <p className="small">
                  {a.release_on && `Release: ${a.release_on} `}
                  {a.ott_on && `OTT: ${a.ott_on} `}
                  {a.theatrical_on && `Cinema: ${a.theatrical_on}`}
                </p>
              )}
            </div>
          )}
        </div>
      ))}
      {all.some((a) => a.origin === "tmdb") && (
        <a
          className="justwatch-attribution"
          href="https://www.justwatch.com/jp"
          target="_blank"
          rel="noreferrer"
        >
          Availability powered by JustWatch
        </a>
      )}
    </div>
  );
}
export function Reviews({
  title: t,
  compact = false,
}: {
  title: Title;
  compact?: boolean;
}) {
  if (!t.reviews.length) return null;
  if (compact)
    return (
      <div className="score-chips">
        {t.reviews
          .filter((r) => r.score)
          .toSorted((a, b) => Number(b.verified) - Number(a.verified))
          .slice(0, 2)
          .map((r, i) => (
            <span key={i} className="score-chip">
              {r.source.replace("Rotten Tomatoes", "RT")}{" "}
              <strong>{r.score}</strong>
              {!r.verified && <small> · unverified</small>}
            </span>
          ))}
      </div>
    );
  return (
    <div className="review-grid">
      {t.reviews.map((r, i) => (
        <article key={i} className="review-tile">
          <p className="eyebrow">{r.source}</p>
          {r.score && <strong className="external-score">{r.score}</strong>}
          {r.critic_score && (
            <p>
              Critics <strong>{r.critic_score}</strong>
            </p>
          )}
          {r.audience_score && (
            <p>
              Audience <strong>{r.audience_score}</strong>
            </p>
          )}
          <p className="small">{r.score_type}</p>
          {r.vote_count !== null && (
            <p className="small">
              {r.vote_count.toLocaleString()} votes / reviews
            </p>
          )}
          <p className="small">
            {r.verified ? "Verified evidence" : "Unverified evidence"}
            {r.captured_on && ` · ${r.captured_on}`}
          </p>
          {r.source_url && (
            <a href={r.source_url} target="_blank" rel="noreferrer">
              View source ↗
            </a>
          )}
          {r.notes && <p className="small">{r.notes}</p>}
        </article>
      ))}
    </div>
  );
}
