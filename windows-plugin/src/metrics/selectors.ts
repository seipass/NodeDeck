import type { MetricSnapshot } from "../protocol/messages.js";

export type MetricType = "cpu" | "memory" | "temperature" | "disk" | "network" | "service" | "docker";
export type MetricSettings = Readonly<{ metricType?: MetricType | undefined; device?: string | undefined }>;
export type SelectedMetric = Readonly<{ label: string; value: number; unit: string }>;

export function selectMetric(snapshot: MetricSnapshot, settings: MetricSettings): SelectedMetric | undefined {
  switch (settings.metricType ?? "cpu") {
    case "cpu": return { label: "CPU", value: snapshot.data.cpu.usagePercent, unit: "%" };
    case "memory": return { label: "MEM", value: snapshot.data.memory.usedPercent, unit: "%" };
    case "temperature": { const item = snapshot.data.temperature?.find((entry) => entry.sensor === settings.device) ?? snapshot.data.temperature?.[0]; return item === undefined ? undefined : { label: item.sensor, value: item.celsius, unit: "°C" }; }
    case "disk": { const item = snapshot.data.disks?.find((entry) => entry.mountpoint === settings.device) ?? snapshot.data.disks?.[0]; return item === undefined ? undefined : { label: item.mountpoint, value: item.usedPercent, unit: "%" }; }
    case "network": { const item = snapshot.data.network?.find((entry) => entry.interface === settings.device) ?? snapshot.data.network?.[0]; return item === undefined ? undefined : rateMetric(item.interface, item.rxBytesPerSecond); }
    case "service": { const item = snapshot.data.services?.find((entry) => entry.name === settings.device) ?? snapshot.data.services?.[0]; return item === undefined ? undefined : { label: item.name, value: item.activeState === "active" ? 1 : 0, unit: item.activeState }; }
    case "docker": { const item = snapshot.data.docker?.find((entry) => entry.name === settings.device) ?? snapshot.data.docker?.[0]; return item === undefined ? undefined : { label: item.name, value: item.state === "running" ? 1 : 0, unit: item.state }; }
    default: return undefined;
  }
}

function rateMetric(label: string, bytes: number): SelectedMetric {
  if (bytes >= 1_000_000_000) return { label, value: bytes / 1_000_000_000, unit: "GB/s" };
  if (bytes >= 1_000_000) return { label, value: bytes / 1_000_000, unit: "MB/s" };
  return { label, value: bytes / 1_000, unit: "KB/s" };
}
