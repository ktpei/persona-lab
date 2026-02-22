export function frictionColor(value: number): string {
  if (value >= 0.6) return "text-red-400";
  if (value >= 0.3) return "text-amber-400";
  return "text-emerald-400";
}

export function frictionBg(value: number): string {
  if (value >= 0.6) return "bg-red-400";
  if (value >= 0.3) return "bg-amber-400";
  return "bg-emerald-400";
}

export function frictionChipClass(value: number): string {
  if (value >= 0.6) return "bg-red-400/15 text-red-400 border-red-400/30";
  if (value >= 0.3) return "bg-amber-400/15 text-amber-400 border-amber-400/30";
  return "bg-emerald-400/15 text-emerald-400 border-emerald-400/30";
}

export function severityLabel(value: number): string {
  if (value >= 0.6) return "High";
  if (value >= 0.3) return "Medium";
  return "Low";
}

export function severityBorderClass(value: number): string {
  if (value >= 0.6) return "border-l-red-400";
  if (value >= 0.3) return "border-l-amber-400";
  return "border-l-emerald-400";
}
