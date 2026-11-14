import type { InputHTMLAttributes } from "react";
import { statuses, statusLabels, type Status } from "@/lib/model";
export function Field({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}
export function TextArea({
  label,
  name,
  value = "",
  required = false,
}: {
  label: string;
  name: string;
  value?: string;
  required?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea name={name} defaultValue={value} rows={3} required={required} />
    </label>
  );
}
export function StatusField({ value = "interested" }: { value?: Status }) {
  return (
    <label className="field">
      <span>Watch status</span>
      <select name="status" defaultValue={value}>
        {statuses.map((s) => (
          <option key={s} value={s}>
            {statusLabels[s]}
          </option>
        ))}
      </select>
    </label>
  );
}
export function RatingField({ value }: { value?: number | null }) {
  return (
    <Field
      label="Your rating · 1–10"
      name="rating"
      type="number"
      min="1"
      max="10"
      step="0.5"
      defaultValue={value ?? ""}
    />
  );
}
