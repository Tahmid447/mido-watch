import Link from "next/link";
import { allTitles } from "@/lib/data";
import { WatchAudit } from "@/components/watch-audit";
export default async function Audit() {
  const titles = await allTitles();
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow gold">A CLEARER PICTURE</p>
          <h1>Watch Audit</h1>
          <p>
            Remember the stories. Confirm your history one title or season at a
            time.
          </p>
        </div>
        <Link href="/plan" className="button">
          My 30-Day Plan ↗
        </Link>
      </div>
      <WatchAudit titles={titles} />
    </>
  );
}
