import Link from "next/link";
import { PackImporter } from "@/components/pack-importer";
export default function Sync() {
  return (
    <>
      <Link href="/settings" className="back-link">
        ← Settings
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow gold">YOUR FRIDAY RITUAL</p>
          <h1>Better picks, with context.</h1>
          <p>A private bridge between your watch journal and ChatGPT.</p>
        </div>
        <Link className="button" href="/recommendations">
          Open recommendation inbox ↗
        </Link>
      </div>
      <div className="bridge-steps">
        <section className="panel">
          <span className="step-number">01</span>
          <h2>Give ChatGPT your taste</h2>
          <p>
            Export a compact file of your watch history, season progress,
            ratings, notes and taste signals.
          </p>
          <a className="button primary" href="/api/export/chatgpt">
            Export for ChatGPT
          </a>
        </section>
        <section className="panel">
          <span className="step-number">02</span>
          <h2>Ask for Friday picks</h2>
          <p>
            Upload the context and ask for recommendations plus a Recommendation
            Pack JSON. Include source links and dates for verified evidence.
          </p>
          <a
            className="button"
            href="/recommendation-pack-example.json"
            download
          >
            Download pack example
          </a>
        </section>
        <section className="panel">
          <span className="step-number">03</span>
          <h2>Review, then bring them home</h2>
          <p>
            Paste or upload the pack below. Check matches and evidence before
            confirming. Accept the picks you want from your inbox.
          </p>
        </section>
      </div>
      <section className="panel">
        <h2>Import recommendations</h2>
        <PackImporter />
      </section>
    </>
  );
}
