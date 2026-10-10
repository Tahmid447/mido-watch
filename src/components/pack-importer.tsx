"use client";
import { useState, useTransition } from "react";
import { previewPack, confirmPack } from "@/app/bridge-actions";
import {
  recommendationPackSchema,
  type PackMatch,
} from "@/lib/recommendation-pack";
import { priorityLabel } from "@/lib/priority";
export function PackImporter() {
  const [text, setText] = useState(""),
    [matches, setMatches] = useState<PackMatch[] | null>(null),
    [choices, setChoices] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [pending, start] = useTransition();
  const change = (s: string) => {
    setText(s);
    setMatches(null);
    setChoices({});
    setError("");
    setMessage("");
  };
  const pack = matches
    ? recommendationPackSchema.safeParse(JSON.parse(text))
    : null;
  return (
    <div className="pack-importer">
      <label className="field">
        <span>Recommendation Pack JSON</span>
        <textarea
          rows={9}
          value={text}
          onChange={(e) => change(e.target.value)}
          placeholder='{"schema_version":1,"generated_at":"…","recommendations":[…]}'
        />
      </label>
      <label className="field">
        <span>Or upload a JSON file · maximum 2 MB</span>
        <input
          type="file"
          accept=".json,application/json"
          disabled={pending}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) {
              if (f.size > 2_000_000) {
                setError("File exceeds 2 MB.");
                return;
              }
              change(await f.text());
            }
          }}
        />
      </label>
      <button
        className="button primary"
        disabled={pending || !text.trim()}
        onClick={() =>
          start(async () => {
            setError("");
            setMessage("");
            const result = await previewPack(text);
            if (result.error) setError(result.error);
            else {
              setMatches(result.matches!);
              setChoices({});
            }
          })
        }
      >
        {pending ? "Checking…" : "Preview changes"}
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="success">
          {message}
        </p>
      )}
      {matches && pack?.success && (
        <section className="import-preview">
          <div className="section-heading">
            <h2>Review your Friday picks</h2>
            <span className="small">{pack.data.generated_at.slice(0, 10)}</span>
          </div>
          <p className="small">
            Your ratings, notes, watch history and season rankings stay intact.
            New titles enter the inbox until you accept them.
          </p>
          {matches.map((m, i) => {
            const r = pack.data.recommendations[i];
            return (
              <article key={i} className="preview-row">
                <div className="section-heading">
                  <h3>
                    {r.title}{" "}
                    {r.release_year && <small>({r.release_year})</small>}
                  </h3>
                  <span className={`badge match-${m.kind}`}>
                    {m.kind === "matched"
                      ? "Existing title"
                      : m.kind === "new"
                        ? "New inbox title"
                        : "Review match"}
                  </span>
                </div>
                <p className="small">
                  {r.media_type} · {r.country} · {priorityLabel(r.priority)} ·{" "}
                  {m.explanation}
                </p>
                <p>{r.reason}</p>
                {r.caveat && (
                  <p className="small">
                    <strong>Caveat:</strong> {r.caveat}
                  </p>
                )}
                {m.kind === "ambiguous" && (
                  <label className="field">
                    <span>Match for {r.title}</span>
                    <select
                      value={choices[String(i)] ?? ""}
                      onChange={(e) =>
                        setChoices({ ...choices, [String(i)]: e.target.value })
                      }
                    >
                      <option value="">Choose before importing</option>
                      {m.candidates.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title} · {c.year ?? "year unknown"} · {c.country}
                        </option>
                      ))}
                      <option value="new">Create a separate title</option>
                    </select>
                  </label>
                )}
                <details>
                  <summary>
                    Evidence to add · {r.reviews.length} reviews,{" "}
                    {r.availability.length} availability records
                  </summary>
                  {r.reviews.map((v, j) => (
                    <p key={j}>
                      {v.source} · {v.score || "Written evidence"} ·{" "}
                      {v.verified ? "Verified" : "Unverified"}
                      {v.source_url && (
                        <>
                          {" "}
                          ·{" "}
                          <a
                            href={v.source_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Source ↗
                          </a>
                        </>
                      )}
                    </p>
                  ))}
                  {r.availability.map((v, j) => (
                    <p key={j}>
                      {v.provider} · {v.region} · {v.kind} ·{" "}
                      {v.verified_on || "Not verified"}
                    </p>
                  ))}
                </details>
              </article>
            );
          })}
          <button
            className="button primary"
            disabled={
              pending ||
              matches.some(
                (m) => m.kind === "ambiguous" && !choices[String(m.index)],
              )
            }
            onClick={() =>
              start(async () => {
                setError("");
                const r = await confirmPack(text, choices);
                if (r.error) setError(r.error);
                else {
                  setMessage(r.message!);
                  setMatches(null);
                }
              })
            }
          >
            {pending ? "Importing…" : "Confirm import"}
          </button>
        </section>
      )}
    </div>
  );
}
