import Link from "next/link";
import { allTitles, watchPlan } from "@/lib/data";
import { PlanBoard } from "@/components/plan-board";
export default async function Plan() {
  const [titles, items] = await Promise.all([allTitles(), watchPlan()]);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow gold">LESS SCROLLING, MORE GOOD STORIES</p>
          <h1>My 30-Day Plan</h1>
          <p>
            A small, flexible queue. Completing a season updates that season
            alone.
          </p>
        </div>
        <Link href="/audit" className="button">
          Check my watch history ↗
        </Link>
      </div>
      <PlanBoard items={items} titles={titles} />
    </>
  );
}
