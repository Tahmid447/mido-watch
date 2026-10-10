import Link from "next/link";
import { library, filtersFrom } from "@/lib/data";
import { TitleCard, Empty } from "@/components/title-card";
export default async function Recommendations({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const f = filtersFrom(await searchParams);
  delete f.limit;
  const { titles, total } = await library({ ...f, recommended: "true" });
  const offset = Number(f.offset || 0);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow gold">A REASON BEHIND EVERY PICK</p>
          <h1>Worth your time.</h1>
          <p>
            Recommendations with context, caveats, and room for your own
            verdict.
          </p>
        </div>
      </div>
      {!titles.length ? (
        <Empty message="Your next recommendation belongs here." />
      ) : (
        <div className="recommendation-grid">
          {titles.map((t, i) => (
            <div key={t.id}>
              <TitleCard title={t} index={i} />
              <div className="recommendation-context">
                <p>
                  <strong>Why it fits</strong>
                  <br />
                  {t.recommendation?.fit || "Not recorded."}
                </p>
                <p>
                  <strong>The caveat</strong>
                  <br />
                  {t.recommendation?.caveat || "Not recorded."}
                </p>
                <p>
                  <strong>Availability</strong>
                  <br />
                  {t.recommendation?.availability_note ||
                    "Not verified. Open the title for regional evidence."}
                </p>
                <p className="small">
                  {t.recommendation?.source} ·{" "}
                  {t.recommendation?.recommended_on} · Priority{" "}
                  {t.recommendation?.priority}
                </p>
                <Link href={`/titles/${t.id}`}>
                  See evidence & update recommendation ↗
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="pagination">
        {offset > 0 && (
          <Link
            className="button"
            href={`/recommendations?offset=${Math.max(0, offset - 24)}`}
          >
            Previous
          </Link>
        )}
        {offset + 24 < total && (
          <Link
            className="button"
            href={`/recommendations?offset=${offset + 24}`}
          >
            Next
          </Link>
        )}
      </div>
      <p className="small">
        Add a recommendation from any title’s detail page. Watch status follows
        your journal; recommendation acceptance is tracked separately.
      </p>
    </>
  );
}
