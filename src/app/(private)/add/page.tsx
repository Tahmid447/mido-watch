import { ActionForm } from "@/components/forms";
import { Field, TextArea, StatusField } from "@/components/fields";
export default function Add() {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow gold">MAKE ROOM FOR A STORY</p>
          <h1>Add to your collection.</h1>
          <p>
            Start with a title. Add evidence and season details whenever you’re
            ready.
          </p>
        </div>
      </div>
      <section className="panel narrow">
        <ActionForm action="add" submit="Add title">
          <div className="form-grid">
            <Field label="Title" name="title" required maxLength={300} />
            <label className="field">
              <span>Type</span>
              <select name="media_type">
                <option value="movie">Movie</option>
                <option value="series">Series</option>
              </select>
            </label>
            <Field label="Country / industry" name="country" />
            <Field
              label="Release year · optional"
              name="release_year"
              type="number"
              min={1800}
              max={2200}
            />
            <StatusField />
            <Field
              label="Priority · 0–100"
              name="priority"
              type="number"
              min={0}
              max={100}
              defaultValue={50}
            />
          </div>
          <Field
            label="Genres / taste tags · comma separated"
            name="tags"
            placeholder="espionage, clever mystery"
          />
          <TextArea label="Synopsis · spoiler-free" name="synopsis" />
        </ActionForm>
      </section>
    </>
  );
}
