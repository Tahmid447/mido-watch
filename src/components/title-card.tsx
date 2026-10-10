import Link from "next/link";
import { ArrowUpRight, Star, Play } from "lucide-react";
import { statusLabels, type Title } from "@/lib/model";
import { ActionForm } from "./forms";
export function TitleCard({
  title: t,
  index = 0,
}: {
  title: Title;
  index?: number;
}) {
  return (
    <article className={`title-card tone-${index % 4}`}>
      <Link
        href={`/titles/${t.id}`}
        className="card-art"
        aria-label={`Open ${t.title}`}
      >
        {t.poster_url ? (
          <img src={t.poster_url} alt="" loading="lazy" />
        ) : (
          <>
            <span className="art-index">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="art-title">{t.title}</span>
            <span className="art-type">
              {t.media_type === "series" ? "A SERIES" : "A FILM"} ·{" "}
              {t.country || "YOUR COLLECTION"}
            </span>
          </>
        )}
        <span className={`badge status-${t.watch.status}`}>
          {statusLabels[t.watch.status]}
        </span>
        <span className="art-open">
          <ArrowUpRight size={20} />
        </span>
      </Link>
      <div className="card-body">
        <div className="eyebrow">
          {t.media_type} {t.release_year && `· ${t.release_year}`}{" "}
          <span>
            {t.watch.rating ? (
              <>
                <Star size={12} /> {t.watch.rating}/10
              </>
            ) : (
              `Priority ${t.watch.priority}`
            )}
          </span>
        </div>
        <h3>
          <Link href={`/titles/${t.id}`}>{t.title}</Link>
        </h3>
        <p className="card-note">
          {t.recommendation?.reason ||
            t.watch.notes ||
            t.synopsis ||
            "A place in your personal collection."}
        </p>
        <div className="card-footer">
          <span>
            {t.seasons.length
              ? `${t.seasons.filter((s) => s.status === "watched").length}/${t.seasons.length} seasons watched`
              : t.country || "Country not set"}
          </span>
          <ActionForm
            action="quick"
            titleId={t.id}
            submit={
              t.watch.status === "watched" ? "Watch again" : "Mark watched"
            }
            className="quick"
          >
            <input
              type="hidden"
              name="status"
              value={t.watch.status === "watched" ? "watching" : "watched"}
            />
          </ActionForm>
        </div>
      </div>
    </article>
  );
}
export function Empty({
  message = "Your next great watch starts here.",
}: {
  message?: string;
}) {
  return (
    <div className="empty">
      <Play size={26} />
      <h3>{message}</h3>
      <p>Add a title, import your V1 history, or adjust your filters.</p>
      <Link className="button" href="/add">
        Add a title
      </Link>
    </div>
  );
}
export function TitleGrid({ titles }: { titles: Title[] }) {
  return titles.length ? (
    <div className="title-grid">
      {titles.map((t, i) => (
        <TitleCard key={t.id} title={t} index={i} />
      ))}
    </div>
  ) : (
    <Empty />
  );
}
