export function renderMetric(label: string, value: number, unit: string, state: "connecting" | "online" | "offline" | "authentication-error" | "metric-unavailable"): string {
  if (state !== "online") return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144"><rect width="144" height="144" fill="#20242b"/><text x="72" y="72" fill="#ffb020" text-anchor="middle" font-size="16">${state}</text></svg>`;
  const bounded = Math.max(0, Math.min(100, value));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144"><rect width="144" height="144" fill="#20242b"/><text x="12" y="24" fill="#fff" font-size="16">${label}</text><text x="72" y="82" fill="#fff" text-anchor="middle" font-size="34">${bounded.toFixed(1)}${unit}</text><rect x="12" y="112" width="120" height="8" rx="4" fill="#48515c"/><rect x="12" y="112" width="${1.2 * bounded}" height="8" rx="4" fill="#4ade80"/></svg>`;
}
