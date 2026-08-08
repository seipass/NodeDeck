export type RenderOptions = Readonly<{ label: string; value: number; unit: string; decimalPlaces: number; warningThreshold?: number | undefined; criticalThreshold?: number | undefined }>;
export type RenderState = "connecting" | "online" | "offline" | "authentication-error" | "agent-error" | "metric-unavailable";

export function renderMetric(options: RenderOptions, state: RenderState): string {
  if (state !== "online") return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144"><rect width="144" height="144" fill="#20242b"/><text x="72" y="72" fill="#ffb020" text-anchor="middle" font-size="16">${state}</text></svg>`;
  const bounded = Math.max(0, Math.min(100, options.value));
  const color = options.criticalThreshold !== undefined && options.value >= options.criticalThreshold ? "#ef4444" : options.warningThreshold !== undefined && options.value >= options.warningThreshold ? "#f59e0b" : "#4ade80";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144"><rect width="144" height="144" fill="#20242b"/><text x="12" y="24" fill="#fff" font-size="16">${options.label}</text><text x="72" y="82" fill="#fff" text-anchor="middle" font-size="34">${options.value.toFixed(Math.max(0, Math.min(6, options.decimalPlaces)))}${options.unit}</text><rect x="12" y="112" width="120" height="8" rx="4" fill="#48515c"/><rect x="12" y="112" width="${1.2 * bounded}" height="8" rx="4" fill="${color}"/></svg>`;
}
