import { priorityLevels, priorityLabel } from "@/lib/priority";
export function PriorityField({ value = 50 }: { value?: number }) {
  return (
    <div className="priority-field">
      <input type="hidden" name="original_priority" value={value} />
      <label className="field">
        <span>Recommendation level</span>
        <select name="priority_level" defaultValue={priorityLabel(value)}>
          {priorityLevels.map((p) => (
            <option key={p.label}>{p.label}</option>
          ))}
        </select>
      </label>
      <details className="advanced-priority">
        <summary>Advanced priority</summary>
        <label className="field">
          <span>Numeric priority · current {value}</span>
          <input
            type="number"
            name="priority"
            min="0"
            max="100"
            placeholder="Optional override"
          />
        </label>
      </details>
    </div>
  );
}
