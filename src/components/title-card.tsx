import Link from "next/link";
import { ArrowUpRight, Star, Play } from "lucide-react";
import { statusLabels, type Title } from "@/lib/model";
import { priorityLabel } from "@/lib/priority";
import { ActionForm } from "./forms";
import { Artwork } from "./artwork";
import { Providers, Reviews } from "./evidence";
export function QuickActions({ title: t }: { title: Title }) {
  return (
    <details className="card-actions">
      <summary>Quick actions</summary>
      <div className="quick-options">
        {(["interested", "watching", "watched", "skip"] as const).map(
          (status) => (
            <ActionForm
              key={status}
              action="quick"
              titleId={t.id}
              submit={statusLabels[status]}
              className="quick"
            >
              <input type="hidden" name="status" value={status} />
            </ActionForm>
          ),
        )}
        <ActionForm
          action="favorite"
          titleId={t.id}
          submit={t.watch.favorite ? "Remove favorite" : "Favorite"}
          className="quick"
        >
          <input
            type="hidden"
            name="favorite"
            value={String(!t.watch.favorite)}
          />
        </ActionForm>
      </div>
    </details>
  );
}
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
        <Artwork
          path={t.metadata.poster_path}
          url={t.poster_url}
          title={t.title}
        />
        <span className={`badge status-${t.watch.status}`}>
          {statusLabels[t.watch.status]}
        </span>
        {t.watch.favorite && (
          <span className="favorite-mark" aria-label="Favorite">
            <Star size={16} fill="currentColor" />
          </span>
        )}
        <span className="art-open">
          <ArrowUpRight size={20} />
        </span>
      </Link>
      <div className="card-body">
        <div className="eyebrow">
          {t.media_type}
          {t.release_year && ` · ${t.release_year}`}
          {t.watch.rating && (
            <span title="Your personal rating">
              <Star size={12} /> {t.watch.rating}/10
            </span>
          )}
        </div>
        <h3>
          <Link href={`/titles/${t.id}`}>{t.title}</Link>
        </h3>
        <span className="pick-level">
          {priorityLabel(t.recommendation?.priority ?? t.watch.priority)}
        </span>
        <p className="card-note">
          {t.recommendation?.reason ||
            t.watch.notes ||
            t.synopsis ||
            `${t.country || "A story"} in your collection.`}
        </p>
        <Reviews title={t} compact />
        <Providers title={t} compact />
        <div className="card-footer">
          <span>
            {t.seasons.length
              ? `${t.seasons.filter((s) => s.status === "watched").length}/${t.seasons.length} seasons watched`
              : t.country || t.metadata.original_language.toUpperCase()}
          </span>
          <QuickActions title={t} />
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
      <p>Add a title or adjust your filters.</p>
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
