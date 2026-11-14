export const priorityLevels = [
  { min: 90, value: 95, label: "Must Watch" },
  { min: 75, value: 82, label: "Strong Pick" },
  { min: 55, value: 65, label: "Worth Watching" },
  { min: 30, value: 45, label: "Maybe" },
  { min: 0, value: 15, label: "Low Priority" },
] as const;
export function priorityLabel(score: number) {
  return priorityLevels.find((p) => score >= p.min)?.label ?? "Low Priority";
}
export function formPriority(f: FormData) {
  const advanced = String(f.get("priority") ?? "");
  if (advanced !== "") return Number(advanced);
  const level = priorityLevels.find((p) => p.label === f.get("priority_level"));
  const original = Number(f.get("original_priority") ?? 50);
  return level
    ? priorityLabel(original) === level.label
      ? original
      : level.value
    : original;
}
