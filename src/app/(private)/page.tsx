import Link from "next/link";
import { ArrowRight, Film, Bookmark, Check, Play } from "lucide-react";
import { library, profile, upcoming, taste } from "@/lib/data";
import { TitleGrid } from "@/components/title-card";
import { Artwork } from "@/components/artwork";
import { Trailer } from "@/components/trailer";
import { priorityLabel } from "@/lib/priority";
export default async function Home() {
  const [
    p,
    all,
    watching,
    watched,
    interested,
    recommended,
    releases,
    signals,
  ] = await Promise.all([
    profile(),
    library({ limit: "1" }),
    library({ status: "watching", limit: "4" }),
    library({ status: "watched", sort: "recent", limit: "4" }),
    library({ status: "interested", limit: "4" }),
    library({ recommended: "true", rec_state: "new", limit: "4" }),
    upcoming(),
    taste(),
  ]);
  const feature =
    recommended.titles.find(
      (t) => !["watched", "skip", "watching"].includes(t.watch.status),
    ) ?? interested.titles[0];
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow gold">YOUR PERSONAL SCREENING ROOM</p>
          <h1>
            Make tonight a good one<span className="gold">.</span>
          </h1>
          <p>
            Welcome back, {p.display_name}. A few stories worth getting lost in.
          </p>
        </div>
        <span className="edition">THE COLLECTION / VOL. 02.1</span>
      </div>
      <section className={`cinema-hero ${feature ? "" : "empty-hero"}`}>
        {feature && (
          <div className="hero-background">
            <Artwork
              path={
                feature.metadata.backdrop_path || feature.metadata.poster_path
              }
              url={feature.poster_url}
              title={feature.title}
              backdrop
              eager
            />
          </div>
        )}
        <div className="cinema-hero-copy">
          <p className="eyebrow gold">
            {feature ? "BEST PICK FOR TONIGHT" : "A NEW CHAPTER"}
          </p>
          <h2>{feature?.title ?? "Your next favorite starts here."}</h2>
          <div className="feature-meta">
            {feature &&
              `${feature.media_type} · ${feature.release_year ?? ""} · ${feature.country} · ${priorityLabel(feature.recommendation?.priority ?? feature.watch.priority)}`}
          </div>
          <p>
            {feature?.recommendation?.reason ||
              feature?.watch.notes ||
              feature?.synopsis ||
              "Bring your watch history together and make room for a great story."}
          </p>
          <div className="hero-actions">
            {feature ? (
              <>
                <Link href={`/titles/${feature.id}`} className="button primary">
                  <Play size={16} /> Explore this title
                </Link>
                <Trailer
                  trailer={feature.metadata.trailer}
                  title={feature.title}
                />
              </>
            ) : (
              <Link href="/settings" className="button primary">
                Import your V1 collection <ArrowRight size={16} />
              </Link>
            )}
          </div>
        </div>
      </section>
      <div className="stats">
        {[
          [Film, all.total, "In your library"],
          [Play, watching.total, "In progress"],
          [Check, watched.total, "Watched"],
          [Bookmark, interested.total, "On your radar"],
        ].map(([Icon, count, label]) => {
          const I = Icon as typeof Film;
          return (
            <div className="stat" key={String(label)}>
              <I size={19} />
              <strong>{String(count)}</strong>
              <span>{String(label)}</span>
            </div>
          );
        })}
      </div>
      {[
        {
          heading: "Continue watching",
          titles: watching.titles,
          url: "/library?status=watching",
        },
        {
          heading: "Your strongest unstarted picks",
          titles: interested.titles,
          url: "/library?status=interested",
        },
        {
          heading: "New Friday recommendations",
          titles: recommended.titles,
          url: "/recommendations",
        },
        {
          heading: "Recently watched",
          titles: watched.titles,
          url: "/library?status=watched&sort=recent",
        },
      ]
        .filter((s) => s.titles.length)
        .map((s) => (
          <section className="section" key={s.heading}>
            <div className="section-heading">
              <h2>{s.heading}</h2>
              <Link href={s.url}>
                View all <ArrowRight size={14} />
              </Link>
            </div>
            <TitleGrid titles={s.titles} />
          </section>
        ))}
      <div className="home-notes">
        <section className="panel">
          <p className="eyebrow gold">COMING INTO VIEW</p>
          <h2>Upcoming releases</h2>
          {releases.length ? (
            releases.map((r, i) => (
              <p key={i}>
                <Link href={`/titles/${r.title_id}`}>{r.title}</Link> ·{" "}
                {r.provider} · {r.region} · {r.event_type}: {r.event_date}
              </p>
            ))
          ) : (
            <p className="small">
              No sourced upcoming dates in {p.region} yet. Your collection will
              surface them when release evidence is recorded.
            </p>
          )}
        </section>
        <section className="panel">
          <p className="eyebrow gold">YOUR SIGNATURE</p>
          <h2>A taste for good stories.</h2>
          <div className="taste-snapshot">
            {signals
              .filter((s) => s.weight > 0)
              .slice(0, 6)
              .map((s) => (
                <span className="badge" key={s.signal}>
                  {s.signal}
                </span>
              ))}
          </div>
          <Link className="small" href="/taste">
            Refine your taste ↗
          </Link>
        </section>
      </div>
    </>
  );
}
