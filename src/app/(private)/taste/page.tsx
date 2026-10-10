import { taste } from "@/lib/data";
import { ActionForm } from "@/components/forms";
import { Field, TextArea } from "@/components/fields";
export default async function Taste() {
  const signals = await taste();
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow gold">MORE THAN A GENRE</p>
          <h1>Your taste, in focus.</h1>
          <p>What draws you in. What puts you off. Room to change your mind.</p>
        </div>
      </div>
      <div className="panel">
        <h2>A compass, not a formula.</h2>
        <p>
          Use −5 for a strong dislike, 0 for neutral, and +5 for a strong
          preference. Quality comes first; there are no country or platform
          quotas.
        </p>
        <ActionForm action="taste-defaults" submit="Add known taste signals" />
      </div>
      <div className="taste-grid">
        {signals.map((s) => (
          <section className="panel" key={s.signal}>
            <div className="section-heading">
              <h3>{s.signal}</h3>
              <span className={s.weight < 0 ? "negative" : "gold"}>
                {s.weight > 0 ? "+" : ""}
                {s.weight}
              </span>
            </div>
            <ActionForm action="taste">
              <input type="hidden" name="signal" value={s.signal} />
              <Field
                label="Preference weight · −5 to +5"
                name="weight"
                type="number"
                min={-5}
                max={5}
                defaultValue={s.weight}
                required
              />
              <TextArea
                label="What matters to you"
                name="notes"
                value={s.notes}
              />
            </ActionForm>
          </section>
        ))}
      </div>
      <section className="panel narrow">
        <h2>Add a taste signal</h2>
        <ActionForm action="taste" submit="Save signal">
          <Field
            label="Signal"
            name="signal"
            required
            placeholder="A satisfying ending"
          />
          <Field
            label="Preference weight · −5 to +5"
            name="weight"
            type="number"
            min={-5}
            max={5}
            defaultValue={3}
            required
          />
          <TextArea label="What matters to you" name="notes" />
        </ActionForm>
      </section>
    </>
  );
}
