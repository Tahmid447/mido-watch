import { PriorityField } from "@/components/priority-field";
import { ActionForm } from "./forms";
import { Field, StatusField, RatingField, TextArea } from "./fields";
import type { Title, Season } from "@/lib/model";
export function WatchEditor({ t }: { t: Title }) {
  return (
    <ActionForm action="watch" titleId={t.id}>
      <input
        type="hidden"
        name="expected_updated_at"
        value={t.watch.updated_at ?? ""}
      />
      <div className="form-grid">
        <StatusField value={t.watch.status} />
        <RatingField value={t.watch.rating} />
        <PriorityField value={t.watch.priority} />
        <Field
          label="Started on"
          name="started_on"
          type="date"
          defaultValue={t.watch.started_on ?? ""}
        />
        <Field
          label="Completed on"
          name="completed_on"
          type="date"
          defaultValue={t.watch.completed_on ?? ""}
        />
      </div>
      <TextArea label="Your notes" name="notes" value={t.watch.notes} />
      <label className="check">
        <input
          type="checkbox"
          name="favorite"
          defaultChecked={t.watch.favorite}
        />{" "}
        A personal favorite
      </label>
    </ActionForm>
  );
}
export function SeasonEditor({ t, s }: { t: Title; s?: Season }) {
  return (
    <details className="season" open={!s}>
      <summary>
        {s
          ? `Season ${s.number} · ${s.status.replace("-", " ")}${s.rank ? ` · Your #${s.rank}` : ""}`
          : "Add a season"}
      </summary>
      <ActionForm
        action="season"
        titleId={t.id}
        submit={s ? "Save season" : "Add season"}
      >
        <input
          type="hidden"
          name="expected_updated_at"
          value={s?.updated_at ?? ""}
        />
        <div className="form-grid">
          <Field
            label="Season number"
            name="number"
            type="number"
            min={0}
            max={1000}
            required
            defaultValue={
              s?.number ?? Math.max(0, ...t.seasons.map((s) => s.number)) + 1
            }
            readOnly={!!s}
          />
          <StatusField value={s?.status ?? "not-watched"} />
          <RatingField value={s?.rating} />
          <Field
            label="Personal rank · optional"
            name="rank"
            type="number"
            min={1}
            defaultValue={s?.rank ?? ""}
          />
          <Field
            label="Completed on"
            name="completed_on"
            type="date"
            defaultValue={s?.completed_on ?? ""}
          />
        </div>
        <TextArea label="Season notes" name="notes" value={s?.notes} />
      </ActionForm>
    </details>
  );
}
export function MetadataEditor({ t }: { t: Title }) {
  return (
    <details className="panel">
      <summary>Edit title metadata</summary>
      <ActionForm action="metadata" titleId={t.id}>
        <input type="hidden" name="media_type" value={t.media_type} />
        <div className="form-grid">
          <Field label="Title" name="title" defaultValue={t.title} required />
          <Field
            label="Original title"
            name="original_title"
            defaultValue={t.original_title ?? ""}
          />
          <Field
            label="Country / industry"
            name="country"
            defaultValue={t.country}
          />
          <Field
            label="Release year"
            name="release_year"
            type="number"
            min={1800}
            max={2200}
            defaultValue={t.release_year ?? ""}
          />
          <Field
            label="IMDb identifier"
            name="imdb_id"
            defaultValue={t.imdb_id ?? ""}
            placeholder="tt1234567"
          />
          <Field
            label="TMDb identifier"
            name="tmdb_id"
            type="number"
            min={1}
            defaultValue={t.tmdb_id ?? ""}
          />
        </div>
        <Field
          label="Poster URL"
          name="poster_url"
          type="url"
          defaultValue={t.poster_url ?? ""}
        />
        <Field
          label="Genres / taste tags · comma separated"
          name="tags"
          defaultValue={t.tags.join(", ")}
        />
        <TextArea label="Synopsis" name="synopsis" value={t.synopsis} />
      </ActionForm>
    </details>
  );
}
export function RecommendationEditor({ t }: { t: Title }) {
  const r = t.recommendation;
  return (
    <details className="panel">
      <summary>{r ? "Edit recommendation" : "Add a recommendation"}</summary>
      <ActionForm action="recommendation" titleId={t.id}>
        <div className="form-grid">
          <Field
            label="Recommendation date"
            name="recommended_on"
            type="date"
            required
            defaultValue={
              r?.recommended_on ?? new Date().toISOString().slice(0, 10)
            }
          />
          <PriorityField value={r?.priority ?? 50} />
          <Field
            label="Source"
            name="source"
            defaultValue={r?.source ?? "Manual"}
            required
          />
          <label className="field">
            <span>Recommendation state</span>
            <select name="state" defaultValue={r?.state ?? "new"}>
              <option value="new">New recommendation</option>
              <option value="accepted">Accepted</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </label>
        </div>
        <TextArea
          label="Spoiler-free reason"
          name="reason"
          value={r?.reason}
          required
        />
        <TextArea label="Why it fits your taste" name="fit" value={r?.fit} />
        <TextArea label="Main caveat" name="caveat" value={r?.caveat} />
        <TextArea
          label="Availability note"
          name="availability_note"
          value={r?.availability_note}
        />
      </ActionForm>
    </details>
  );
}
export function EvidenceEditors({ t }: { t: Title }) {
  return (
    <>
      <details className="panel">
        <summary>Add external review evidence</summary>
        <ActionForm action="review" titleId={t.id}>
          <div className="form-grid">
            <Field label="Source / reviewer" name="source" required />
            <Field label="Score · as published" name="score" />
            <Field
              label="Score type"
              name="score_type"
              defaultValue="out of 10"
              required
            />
            <Field label="Critic score · optional" name="critic_score" />
            <Field label="Audience score · optional" name="audience_score" />
            <Field
              label="Vote / review count"
              name="vote_count"
              type="number"
              min={0}
            />
            <Field label="Captured on" name="captured_on" type="date" />
            <Field label="Source URL" name="source_url" type="url" />
          </div>
          <TextArea label="Evidence notes" name="notes" />
          <label className="check">
            <input type="checkbox" name="verified" /> Verified against the
            linked source
          </label>
        </ActionForm>
      </details>
      <details className="panel">
        <summary>Add regional availability</summary>
        <ActionForm action="availability" titleId={t.id}>
          <div className="form-grid">
            <Field
              label="Provider / cinema"
              name="provider"
              placeholder="U-NEXT, Netflix, rental store…"
              required
            />
            <Field
              label="Region · two-letter code"
              name="region"
              defaultValue="JP"
              pattern="[A-Za-z]{2}"
              required
            />
            <label className="field">
              <span>Availability type</span>
              <select name="kind">
                {["subscription", "rent", "buy", "theatrical", "unknown"].map(
                  (k) => (
                    <option key={k}>{k}</option>
                  ),
                )}
              </select>
            </label>
            <Field
              label="Release date · if known"
              name="release_on"
              type="date"
            />
            <Field label="OTT date · if known" name="ott_on" type="date" />
            <Field
              label="Theatrical date · if known"
              name="theatrical_on"
              type="date"
            />
            <Field
              label="Verified on · if checked"
              name="verified_on"
              type="date"
            />
            <Field label="Source URL" name="source_url" type="url" />
          </div>
          <TextArea label="Availability notes" name="notes" />
        </ActionForm>
      </details>
    </>
  );
}
