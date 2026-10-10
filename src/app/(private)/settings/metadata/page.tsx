import Link from "next/link";
import { z } from "zod";
import { session, documentSchema } from "@/lib/data";
import { tmdbConfigured } from "@/lib/tmdb";
import { ActionForm } from "@/components/forms";
import { Field } from "@/components/fields";
import { Artwork } from "@/components/artwork";
import { refreshMetadata } from "@/app/bridge-actions";
export default async function Metadata() {
  const { db } = await session();
  const { data, error } = await db.rpc("export_library");
  if (error) throw new Error(error.message);
  const titles = z
    .object({ titles: z.array(documentSchema) })
    .parse(data)
    .titles.sort((a, b) => a.title.localeCompare(b.title));
  const ready = tmdbConfigured(),
    review = titles.filter((t) => t.metadata.state === "needs-review"),
    matched = titles.filter((t) => t.metadata.state === "matched").length;
  return (
    <>
      <Link href="/settings" className="back-link">
        ← Settings
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow gold">THE STORIES BEHIND YOUR TITLES</p>
          <h1>Artwork & metadata.</h1>
          <p>
            Resolve artwork, trailers and Japan streaming providers while
            keeping your journals intact.
          </p>
        </div>
      </div>
      <section className="panel metadata-control">
        <div>
          <h2>
            {matched} of {titles.length} titles enriched
          </h2>
          <p>
            {review.length} require a match review. TMDb{" "}
            {ready ? "is connected." : "needs a server token."}
          </p>
          <p className="small">
            Refresh checks up to six missing titles at a time. Your notes,
            ratings and season rankings stay intact.
          </p>
        </div>
        {ready ? (
          <ActionForm
            handler={refreshMetadata}
            submit="Refresh missing metadata"
          />
        ) : (
          <p className="small">
            Add <code>TMDB_READ_ACCESS_TOKEN</code> or <code>TMDB_API_KEY</code>{" "}
            to the server’s <code>.env.local</code> and restart the local app.
          </p>
        )}
      </section>
      {review.length > 0 && (
        <section className="section">
          <h2>Review ambiguous matches</h2>
          <p className="small">
            Compare year, territory and overview before selecting the correct
            edition.
          </p>
          {review.map((t) => (
            <section className="panel" key={t.id}>
              <Link href={`/titles/${t.id}`}>
                <h3>{t.title}</h3>
              </Link>
              <p className="small">
                {t.media_type} · {t.release_year || "Year unknown"} ·{" "}
                {t.country}
              </p>
              <div className="match-candidates">
                {t.metadata.candidates.map((c) => (
                  <article className="match-candidate" key={c.id}>
                    <Artwork path={c.poster_path} title={c.title} />
                    <div>
                      <h4>{c.title}</h4>
                      <p className="small">
                        {c.year} · {c.countries.join(" / ")} · TMDb {c.id}
                      </p>
                      <p>{c.overview.slice(0, 240)}</p>
                      <ActionForm
                        handler={refreshMetadata}
                        titleId={t.id}
                        submit="Use this match"
                      >
                        <input type="hidden" name="tmdb_id" value={c.id} />
                      </ActionForm>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </section>
      )}
      <section className="panel">
        <h2>Refresh a selected title</h2>
        <ActionForm handler={refreshMetadata} submit="Refresh selected title">
          <label className="field">
            <span>Title</span>
            <select name="title_id" required>
              {titles.map((t) => (
                <option value={t.id} key={t.id}>
                  {t.title} · {t.metadata.state}
                </option>
              ))}
            </select>
          </label>
          <div className="field-row">
            <Field
              label="Alternative search · optional"
              name="query"
              placeholder="Try an original or translated title"
            />
            <Field
              label="Known TMDb ID · optional"
              name="tmdb_id"
              type="number"
              min="1"
            />
          </div>
        </ActionForm>
      </section>
      <section className="panel">
        <h2>Enrichment history</h2>
        <div className="metadata-history">
          {titles.map((t) => (
            <div key={t.id}>
              <Link href={`/titles/${t.id}`}>{t.title}</Link>
              <span className={`badge match-${t.metadata.state}`}>
                {t.metadata.state.replaceAll("-", " ")}
              </span>
              <span className="small">
                {t.metadata.refreshed_at?.slice(0, 10) || "Not checked"}
              </span>
              {t.metadata.error && (
                <p className="small error">{t.metadata.error}</p>
              )}
            </div>
          ))}
        </div>
      </section>
      <p className="small">
        This product uses the TMDB API but is not endorsed or certified by TMDB.
        Streaming provider metadata is powered by JustWatch; check availability
        before subscribing.
      </p>
    </>
  );
}
