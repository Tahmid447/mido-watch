import Link from "next/link";
import { library, filtersFrom } from "@/lib/data";
import { statuses, statusLabels } from "@/lib/model";
import { TitleGrid } from "@/components/title-card";
export default async function Library({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const f = filtersFrom(await searchParams);
  delete f.limit;
  const result = await library(f);
  const offset = Number(f.offset || 0);
  const pageLink = (n: number) =>
    `/library?${new URLSearchParams({ ...f, offset: String(n) })}`;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow gold">QUEUE, HISTORY & EVERYTHING BETWEEN</p>
          <h1>
            Your collection<span className="gold">.</span>
          </h1>
          <p>
            Every story has its place. {result.total} titles match your
            selection.
          </p>
        </div>
      </div>
      <form className="filters" action="/library">
        <input
          name="q"
          aria-label="Search library"
          placeholder="Search titles, notes, country…"
          defaultValue={f.q}
        />
        <select
          name="status"
          aria-label="Filter by status"
          defaultValue={f.status}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
        <select name="type" aria-label="Filter by type" defaultValue={f.type}>
          <option value="">Movies + series</option>
          <option value="movie">Movies</option>
          <option value="series">Series</option>
        </select>
        <select
          name="sort"
          aria-label="Sort titles"
          defaultValue={f.sort ?? "priority"}
        >
          <option value="priority">Best picks first</option>
          <option value="title">Title A–Z</option>
          <option value="rating">Personal rating</option>
          <option value="recent">Recently updated</option>
        </select>
        <div className="filter-buttons">
          <button className="button primary">Apply filters</button>
          <Link className="button" href="/library">
            Reset
          </Link>
        </div>
        <details className="advanced">
          <summary>More filters</summary>
          <div className="form-grid">
            {[
              ["country", "Country"],
              ["platform", "Platform"],
              ["tag", "Genre / taste tag"],
              ["rating", "Minimum rating"],
              ["priority", "Minimum priority"],
              ["year", "Release year"],
            ].map(([key, label]) => (
              <label className="field" key={key}>
                <span>{label}</span>
                <input
                  name={key}
                  defaultValue={f[key]}
                  type={
                    ["rating", "priority", "year"].includes(key)
                      ? "number"
                      : "text"
                  }
                  min={key === "year" ? 1800 : 0}
                  max={
                    key === "rating" ? 10 : key === "priority" ? 100 : undefined
                  }
                />
              </label>
            ))}
          </div>
        </details>
      </form>
      <TitleGrid titles={result.titles} />
      <div className="pagination">
        {offset > 0 && (
          <Link className="button" href={pageLink(Math.max(0, offset - 24))}>
            Previous
          </Link>
        )}
        <span>
          {result.total
            ? `${offset + 1}–${Math.min(offset + 24, result.total)} of ${result.total}`
            : "No results"}
        </span>
        {offset + 24 < result.total && (
          <Link className="button" href={pageLink(offset + 24)}>
            Next
          </Link>
        )}
      </div>
    </>
  );
}
