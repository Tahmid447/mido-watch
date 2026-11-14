import Link from "next/link";
import { PackImporter } from "@/components/pack-importer";
import { CopyContext } from "@/components/copy-context";
export default function Sync() {
  return (
    <>
      <Link href="/settings" className="back-link">
        ← Settings
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow gold">GOOD PICKS, LESS ADMIN</p>
          <h1>Update from ChatGPT</h1>
          <p>
            Start with your watch history. Bring back a few stories worth your
            time.
          </p>
        </div>
        <Link className="button" href="/audit">
          Open Watch Audit ↗
        </Link>
      </div>
      <section className="panel sync-friendly">
        <h2>A simpler weekly rhythm</h2>
        <ol>
          <li>Confirm what you watched in Watch Audit.</li>
          <li>
            Copy your context into ChatGPT and ask for a short shortlist with
            reasons, caveats and verified source links.
          </li>
          <li>
            Browse your picks and add the ones you want to your 30-Day Plan. You
            can add a title directly; no file is required.
          </li>
        </ol>
        <p className="small">
          Your context includes your notes and reactions. Share it only in a
          conversation you choose.
        </p>
        <div className="hero-actions">
          <CopyContext />
          <a className="button" href="/api/export/chatgpt">
            Download context
          </a>
          <Link className="button" href="/recommendations">
            Browse my picks ↗
          </Link>
          <Link className="button" href="/add">
            Add a recommended title
          </Link>
        </div>
      </section>
      <details className="panel sync-wizard">
        <summary>Import a structured shortlist</summary>
        <p>
          Already have a Recommendation Pack from ChatGPT? Choose the file,
          review its poster-ready title matches and evidence, resolve any
          editions, then confirm. Your journals stay intact.
        </p>
        <PackImporter mode="wizard" />
      </details>
      <details className="panel sync-advanced">
        <summary>Advanced · JSON tools & backups</summary>
        <p className="small">
          The original secure JSON bridge remains available when you need it.
        </p>
        <PackImporter />
        <div className="hero-actions">
          <a
            className="button"
            href="/recommendation-pack-example.json"
            download
          >
            Download pack example
          </a>
          <a className="button" href="/api/export">
            Download full backup
          </a>
          <Link href="/settings">Backup restore & settings ↗</Link>
        </div>
      </details>
    </>
  );
}
