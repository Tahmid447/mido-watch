"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { changePlan } from "@/app/watch-actions";
import type { PlanItem, Title } from "@/lib/model";
import { priorityLabel } from "@/lib/priority";
import { Artwork } from "./artwork";
import { ActionForm } from "./forms";
function ScopePicker({
  titles,
  name = "title_id",
}: {
  titles: Title[];
  name?: string;
}) {
  const [selected, setSelected] = useState("");
  const title = titles.find((t) => t.id === selected);
  return (
    <>
      <label className="field">
        <span>Choose a title</span>
        <select
          name={name}
          value={selected}
          required
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Choose from your collection</option>
          {titles.map((t) => (
            <option value={t.id} key={t.id}>
              {t.title}
              {t.release_year ? ` (${t.release_year})` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Watch scope</span>
        <select key={selected} name="season" defaultValue="">
          <option value="">Entire title</option>
          {title?.seasons.map((s) => (
            <option key={s.number} value={s.number}>
              Season {s.number}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
function WeekPicker({ value = "1" }: { value?: string }) {
  return (
    <label className="field">
      <span>Plan week</span>
      <select name="week" defaultValue={value}>
        {[1, 2, 3, 4].map((w) => (
          <option value={w} key={w}>
            Week {w}
          </option>
        ))}
        <option value="">Backup</option>
      </select>
    </label>
  );
}
function PlanControls({ item, title }: { item: PlanItem; title: Title }) {
  const [result, action, pending] = useActionState(changePlan, {});
  const journal =
    item.season_number === null
      ? title.watch
      : title.seasons.find((s) => s.number === item.season_number);
  return (
    <form action={action} className="plan-controls">
      <input type="hidden" name="item_id" value={item.id} />
      <input type="hidden" name="expected" value={item.updated_at} />
      <input
        type="hidden"
        name="journal_expected"
        value={journal?.updated_at ?? ""}
      />
      <fieldset disabled={pending}>
        {(
          [
            ["up", "Move up"],
            ["down", "Move down"],
            ["start", "Mark started"],
            ["complete", "Mark completed"],
            ["postpone", "Postpone"],
            ["remove", "Remove"],
          ] as const
        ).map(([action, label]) => (
          <button
            type="submit"
            key={action}
            name="plan_action"
            value={action}
            disabled={
              (action === "start" && item.status === "started") ||
              (action === "complete" && item.status === "completed")
            }
          >
            {label}
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
export function PlanBoard({
  items,
  titles,
}: {
  items: PlanItem[];
  titles: Title[];
}) {
  const visible = items.filter((i) => i.status !== "removed"),
    active = visible.filter((i) => !i.is_backup && i.status !== "postponed"),
    done = active.filter((i) => i.status === "completed").length;
  const recommendations = titles.filter(
    (t) =>
      t.recommendation &&
      t.recommendation.state !== "dismissed" &&
      !["watched", "skip"].includes(t.watch.status),
  );
  const card = (item: PlanItem) => {
    const t = titles.find((t) => t.id === item.title_id);
    if (!t) return null;
    return (
      <article className="plan-card" key={item.id}>
        <div className="plan-card-top">
          <Link href={`/titles/${t.id}`} className="plan-poster">
            <Artwork
              path={t.metadata.poster_path}
              url={t.poster_url}
              title={t.title}
            />
          </Link>
          <div>
            <p className="eyebrow">
              {item.status} ·{" "}
              {priorityLabel(t.recommendation?.priority ?? t.watch.priority)}
            </p>
            <h3>
              <Link href={`/titles/${t.id}`}>{t.title}</Link>
            </h3>
            <p className="small">
              {item.label ||
                (item.season_number === null
                  ? "Entire title"
                  : `Season ${item.season_number}`)}
            </p>
            {item.season_number !== null && (
              <p className="small">
                Season actions leave your other season journals intact.
              </p>
            )}
          </div>
        </div>
        <PlanControls item={item} title={t} />
        <details className="plan-edit">
          <summary>Reschedule or replace</summary>
          <ActionForm handler={changePlan} submit="Move to this week">
            <input type="hidden" name="plan_action" value="schedule" />
            <input type="hidden" name="item_id" value={item.id} />
            <input type="hidden" name="expected" value={item.updated_at} />
            <WeekPicker value={item.week?.toString() ?? ""} />
          </ActionForm>
          {recommendations.length > 0 && (
            <ActionForm handler={changePlan} submit="Replace with this pick">
              <input type="hidden" name="plan_action" value="replace" />
              <input type="hidden" name="item_id" value={item.id} />
              <input type="hidden" name="expected" value={item.updated_at} />
              <ScopePicker name="replacement" titles={recommendations} />
            </ActionForm>
          )}
        </details>
      </article>
    );
  };
  return (
    <>
      <div className="plan-summary">
        <div>
          <strong>
            {done} of {active.length}
          </strong>
          <span> planned watches completed</span>
        </div>
        <progress
          value={done}
          max={Math.max(active.length, 1)}
          aria-label="30-day plan progress"
        />
        <p className="small">
          Four weeks of focused picks, with a little room to catch up. Move
          across weeks, postpone freely, and keep backups close.
        </p>
      </div>
      <div className="plan-weeks">
        {[1, 2, 3, 4].map((w) => (
          <section className="plan-week" key={w}>
            <p className="eyebrow gold">WEEK {w}</p>
            {active.filter((i) => i.week === w).map(card)}
            {!active.some((i) => i.week === w) && (
              <p className="small">Room for your next pick.</p>
            )}
          </section>
        ))}
      </div>
      {visible.some((i) => i.is_backup && i.status !== "postponed") && (
        <section className="section">
          <h2>Backups</h2>
          <div className="plan-extras">
            {visible
              .filter((i) => i.is_backup && i.status !== "postponed")
              .map(card)}
          </div>
        </section>
      )}
      {visible.some((i) => i.status === "postponed") && (
        <section className="section">
          <h2>For another time</h2>
          <div className="plan-extras">
            {visible.filter((i) => i.status === "postponed").map(card)}
          </div>
        </section>
      )}
      <details className="panel section">
        <summary>Add a watch to your plan</summary>
        <ActionForm handler={changePlan} submit="Add to plan">
          <input type="hidden" name="plan_action" value="add" />
          <ScopePicker
            titles={titles.filter((t) => t.watch.status !== "skip")}
          />
          <WeekPicker />
        </ActionForm>
      </details>
      {!visible.length && (
        <p className="small">
          Your private plan is ready to fill. Add titles above or choose a
          replacement from your recommendation inbox.
        </p>
      )}
    </>
  );
}
