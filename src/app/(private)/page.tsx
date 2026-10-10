import Link from "next/link";
import { ArrowRight, Film, Bookmark, Check, Play } from "lucide-react";
import { library, profile, upcoming } from "@/lib/data";
import { TitleGrid } from "@/components/title-card";
export default async function Home() {
  const [p, all, watching, watched, interested, recommended, releases] =
    await Promise.all([
      profile(),
      library({ limit: "1" }),
      library({ status: "watching", limit: "3" }),
      library({ status: "watched", sort: "recent", limit: "3" }),
      library({ status: "interested", limit: "3" }),
      library({ recommended: "true", limit: "3" }),
      upcoming(),
    ]);
  const feature =
    recommended.titles.find(
      (t) => !["watched", "skip"].includes(t.watch.status),
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
            A few worthy stories, chosen with intention. Welcome back,{" "}
            {p.display_name}.
          </p>
        </div>
        <span className="edition">THE COLLECTION / VOL. 02</span>
      </div>
      <section className="feature">
        <div className="feature-copy">
          <p className="eyebrow gold">
            {feature ? "ON YOUR RADAR" : "A NEW CHAPTER"}
          </p>
          <h2>{feature?.title ?? "Less scrolling.\nBetter watching."}</h2>
          <p>
            {feature?.recommendation?.reason ||
              feature?.watch.notes ||
              "Bring your watch history together, keep track of every season, and make room for your next favorite."}
          </p>
          {feature ? (
            <>
              <div className="feature-meta">
                {feature.media_type.toUpperCase()} <span>·</span>{" "}
                {feature.country} <span>·</span> Priority{" "}
                {feature.watch.priority}
              </div>
              <Link href={`/titles/${feature.id}`} className="button primary">
                <Play size={16} /> Explore this title
              </Link>
            </>
          ) : (
            <Link href="/settings" className="button primary">
              Import your V1 collection <ArrowRight size={16} />
            </Link>
          )}
        </div>
        <div className="feature-art" aria-hidden="true">
          <div className="frame frame-one" />
          <div className="frame frame-two" />
          <div className="frame frame-three" />
          <span>
            THE NEXT
            <br />
            GREAT STORY
          </span>
          <small>MIDO / PERSONAL SELECTION</small>
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
        ["Continue the story", watching.titles, "watching"],
        ["High on your list", interested.titles, "interested"],
        ["Recently updated · watched", watched.titles, "watched"],
      ].map(([heading, titles, status]) => (
        <section className="section" key={heading as string}>
          <div className="section-heading">
            <h2>{heading as string}</h2>
            <Link href={`/library?status=${status}`}>
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <TitleGrid titles={titles as typeof watched.titles} />
        </section>
      ))}
      <section className="section panel">
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
          <p>
            No verified upcoming dates yet. Add regional release evidence on a
            title’s detail page.
          </p>
        )}
      </section>
    </>
  );
}
