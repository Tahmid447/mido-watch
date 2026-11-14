"use client";
import { useActionState } from "react";
import { confirmWatch } from "@/app/watch-actions";
import { statusLabels, type Title, type Season } from "@/lib/model";
export function AuditControls({
  title,
  season,
}: {
  title: Title;
  season?: Season;
}) {
  const [result, action, pending] = useActionState(confirmWatch, {}),
    journal = season ?? title.watch;
  return (
    <form
      action={action}
      className="audit-controls"
      aria-label={
        season
          ? `${title.title} season ${season.number} status`
          : `${title.title} status`
      }
    >
      <input type="hidden" name="title_id" value={title.id} />
      <input type="hidden" name="expected" value={journal.updated_at ?? ""} />
      {season && <input type="hidden" name="season" value={season.number} />}
      <fieldset disabled={pending}>
        {(
          [
            "watched",
            "watching",
            "not-watched",
            "interested",
            "skip",
            "unsure",
          ] as const
        ).map((s) => (
          <button
            key={s}
            type="submit"
            name="status"
            value={s}
            aria-pressed={
              s === "unsure"
                ? journal.confirmation_needed
                : journal.status === s && !journal.confirmation_needed
            }
          >
            {s === "unsure" ? "Unsure" : statusLabels[s]}
          </button>
        ))}
      </fieldset>
      {result.error && (
        <p role="alert" className="error">
          {result.error}
        </p>
      )}
      {result.message && (
        <p role="status" className="small">
          {result.message}
        </p>
      )}
    </form>
  );
}
