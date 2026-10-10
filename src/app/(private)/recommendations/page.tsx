import Link from "next/link";
import { library, filtersFrom } from "@/lib/data";
import { Artwork } from "@/components/artwork";
import { Providers, Reviews } from "@/components/evidence";
import { Trailer } from "@/components/trailer";
import { ActionForm } from "@/components/forms";
import { priorityLabel } from "@/lib/priority";
export default async function Recommendations({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const f = filtersFrom(await searchParams);
  delete f.limit;
  const state = ["new", "accepted", "dismissed"].includes(f.rec_state)
    ? f.rec_state
    : "new";
  const { titles, total } = await library({
      ...f,
      recommended: "true",
      rec_state: state,
    }),
    offset = Number(f.offset || 0);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow gold">A REASON BEHIND EVERY PICK</p>
          <h1>Your recommendation inbox.</h1>
          <p>Consider the story. Keep the ones that feel right.</p>
        </div>
        <Link className="button primary" href="/settings/sync">
          Import Friday picks
        </Link>
      </div>
      <nav className="inbox-tabs" aria-label="Recommendation state">
        {["new", "accepted", "dismissed"].map((s) => (
          <Link
            key={s}
            className={state === s ? "active" : ""}
            href={`/recommendations?rec_state=${s}`}
          >
            {s === "new" ? "New picks" : s[0].toUpperCase() + s.slice(1)}
          </Link>
        ))}
        <span>{total} picks</span>
      </nav>
      {!titles.length && (
        <div className="inbox-empty">
          <p className="eyebrow gold">ROOM FOR SOMETHING GOOD</p>
          <h2>
            {state === "new"
              ? "Your next Friday shortlist starts here."
              : `No ${state} picks yet.`}
          </h2>
          <p>
            Export your context to ChatGPT, then bring back a pack of
            recommendations with reasons and evidence.
          </p>
          <Link className="button" href="/settings/sync">
            Open the ChatGPT bridge ↗
          </Link>
        </div>
      )}
      <div className="inbox-list">
        {titles.map((t) => (
          <article className="inbox-card" key={t.id}>
            <Link href={`/titles/${t.id}`} className="inbox-poster">
              <Artwork
                path={t.metadata.poster_path}
                url={t.poster_url}
                title={t.title}
              />
            </Link>
            <div className="inbox-copy">
              <div className="section-heading">
                <p className="eyebrow">
                  {t.media_type} · {t.release_year} · {t.country}
                </p>
                <span className="pick-level">
                  {priorityLabel(t.recommendation!.priority)}
                </span>
              </div>
              <h2>
                <Link href={`/titles/${t.id}`}>{t.title}</Link>
              </h2>
              <p className="recommendation-reason">
                {t.recommendation!.reason}
              </p>
              <div className="fit-caveat">
                {t.recommendation!.fit && (
                  <div>
                    <h3>Why it fits</h3>
                    <p>{t.recommendation!.fit}</p>
                  </div>
                )}
                {t.recommendation!.caveat && (
                  <div>
                    <h3>Main caveat</h3>
                    <p>{t.recommendation!.caveat}</p>
                  </div>
                )}
              </div>
              <Reviews title={t} compact />
              <Providers title={t} compact />
              <p className="small">
                {t.recommendation!.runtime_or_episode_count} ·{" "}
                {t.recommendation!.source} · {t.recommendation!.recommended_on}
              </p>
              <div className="inbox-actions">
                {(
                  [
                    ["interested", "Add to Interested"],
                    ["watching", "Start Watching"],
                    ["dismiss", "Dismiss"],
                    ["skip", "Skip"],
                  ] as const
                ).map(([action, label]) => (
                  <ActionForm
                    key={action}
                    action="inbox"
                    titleId={t.id}
                    submit={label}
                    className="quick"
                  >
                    <input type="hidden" name="inbox_action" value={action} />
                  </ActionForm>
                ))}
                <Trailer trailer={t.metadata.trailer} title={t.title} />
                <Link href={`/titles/${t.id}`} className="button">
                  Open detail ↗
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="pagination">
        {offset > 0 && (
          <Link
            className="button"
            href={`/recommendations?rec_state=${state}&offset=${Math.max(0, offset - 24)}`}
          >
            Previous
          </Link>
        )}
        {offset + 24 < total && (
          <Link
            className="button"
            href={`/recommendations?rec_state=${state}&offset=${offset + 24}`}
          >
            Next
          </Link>
        )}
      </div>
    </>
  );
}
