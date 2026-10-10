import { profile, session } from "@/lib/data";
import { ActionForm } from "@/components/forms";
import { Field } from "@/components/fields";
export default async function Settings() {
  const [p, { user }] = await Promise.all([profile(), session()]);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow gold">YOURS TO KEEP</p>
          <h1>A home for your collection.</h1>
          <p>
            Account preferences, portable backups, and a careful bridge from V1.
          </p>
        </div>
      </div>
      <div className="detail-columns">
        <section className="panel">
          <h2>Your profile</h2>
          <p className="small">Signed in as {user.email}</p>
          <ActionForm action="profile">
            <Field
              label="Display name"
              name="display_name"
              defaultValue={p.display_name}
            />
            <Field
              label="Preferred region · two-letter code"
              name="region"
              defaultValue={p.region}
              pattern="[A-Za-z]{2}"
              required
            />
          </ActionForm>
        </section>
        <section className="panel">
          <h2>Back up your collection</h2>
          <p>
            Export titles, seasons, your ratings and notes, review evidence,
            recommendations, taste signals, and profile preferences.
          </p>
          <a className="button primary" href="/api/export">
            Download JSON backup
          </a>
          <p className="small">Keep dated backups somewhere you trust.</p>
        </section>
        <section className="panel">
          <h2>Bring V1 with you</h2>
          <p>
            Import the 47 original entries as 44 titles with 6 season records.
            This includes your Reacher ranking and watched history. Legacy
            scores and platform claims are marked unverified.
          </p>
          <ActionForm action="seed" submit="Import preserved V1 history" />
          <p className="small">
            Existing titles are kept unchanged. This action is safe to repeat.
          </p>
        </section>
        <section className="panel">
          <h2>Import a JSON backup</h2>
          <p>
            Accepts V2 backups, V1 exports, and the V1 localStorage array.
            Import adds missing titles and skips existing ones, including their
            related data. It never replaces your library.
          </p>
          <ActionForm action="import" submit="Import backup">
            <Field
              label="JSON backup · maximum 3 MB"
              name="file"
              type="file"
              accept="application/json,.json"
              required
            />
          </ActionForm>
          <p className="small">
            For your latest V1 edits, export JSON from the original browser.
            Browser storage cannot be read across sites.
          </p>
        </section>
      </div>
    </>
  );
}
