import type { MetricSnapshot } from "../protocol/messages.js";

export type MetricType = "cpu" | "cpu-load1" | "cpu-load5" | "cpu-load15" | "memory" | "memory-swap" | "temperature" | "disk" | "disk-read" | "disk-write" | "network" | "network-upload" | "service" | "docker" | "docker-cpu" | "docker-memory" | "docker-uptime" | "custom";
export type MetricSettings = Readonly<{ metricType?: MetricType | undefined; device?: string | undefined; customMetricId?: string | undefined }>;
export type SelectedMetric = Readonly<{ label: string; value: number; displayValue?: string; unit: string }>;

export function selectMetric(snapshot: MetricSnapshot, settings: MetricSettings): SelectedMetric | undefined {
  switch (settings.metricType ?? "cpu") {
    case "cpu": return { label: "CPU", value: snapshot.data.cpu.usagePercent, unit: "%" };
    case "cpu-load1": return { label: "LOAD 1m", value: snapshot.data.cpu.load1, unit: "" };
    case "cpu-load5": return { label: "LOAD 5m", value: snapshot.data.cpu.load5, unit: "" };
    case "cpu-load15": return { label: "LOAD 15m", value: snapshot.data.cpu.load15, unit: "" };
    case "memory": return { label: "MEM", value: snapshot.data.memory.usedPercent, unit: "%" };
    case "memory-swap": return { label: "SWAP", value: snapshot.data.memory.swapUsedPercent, unit: "%" };
    case "temperature": { const item = snapshot.data.temperature?.find((entry) => entry.sensor === settings.device) ?? snapshot.data.temperature?.[0]; return item === undefined ? undefined : { label: item.sensor, value: item.celsius, unit: "°C" }; }
    case "disk": { const item = snapshot.data.disks?.find((entry) => entry.mountpoint === settings.device) ?? snapshot.data.disks?.[0]; return item === undefined ? undefined : { label: item.mountpoint, value: item.usedPercent, unit: "%" }; }
    case "disk-read": { const item = snapshot.data.disks?.find((entry) => entry.mountpoint === settings.device) ?? snapshot.data.disks?.[0]; return item === undefined ? undefined : rateMetric(`${item.mountpoint} R`, item.readBytesPerSecond); }
    case "disk-write": { const item = snapshot.data.disks?.find((entry) => entry.mountpoint === settings.device) ?? snapshot.data.disks?.[0]; return item === undefined ? undefined : rateMetric(`${item.mountpoint} W`, item.writeBytesPerSecond); }
    case "network": { const item = snapshot.data.network?.find((entry) => entry.interface === settings.device) ?? snapshot.data.network?.[0]; return item === undefined ? undefined : rateMetric(item.interface, item.rxBytesPerSecond); }
    case "network-upload": { const item = snapshot.data.network?.find((entry) => entry.interface === settings.device) ?? snapshot.data.network?.[0]; return item === undefined ? undefined : rateMetric(`${item.interface} TX`, item.txBytesPerSecond); }
    case "service": { const item = snapshot.data.services?.find((entry) => entry.name === settings.device) ?? snapshot.data.services?.[0]; return item === undefined ? undefined : { label: item.name, value: item.activeState === "active" ? 1 : 0, unit: item.activeState }; }
    case "docker": { const item = snapshot.data.docker?.find((entry) => entry.name === settings.device) ?? snapshot.data.docker?.[0]; return item === undefined ? undefined : { label: item.name, value: item.state === "running" ? 1 : 0, unit: item.state }; }
    case "docker-cpu": { const item = snapshot.data.docker?.find((entry) => entry.name === settings.device) ?? snapshot.data.docker?.[0]; return item?.cpuPercent === undefined ? undefined : { label: item.name, value: item.cpuPercent, unit: "%" }; }
    case "docker-memory": { const item = snapshot.data.docker?.find((entry) => entry.name === settings.device) ?? snapshot.data.docker?.[0]; return item?.memoryUsageBytes === undefined ? undefined : bytesMetric(item.name, item.memoryUsageBytes); }
    case "docker-uptime": { const item = snapshot.data.docker?.find((entry) => entry.name === settings.device) ?? snapshot.data.docker?.[0]; return item?.uptimeSeconds === undefined ? undefined : { label: item.name, value: item.uptimeSeconds, unit: "s" }; }
    case "custom": { const item = snapshot.data.custom?.find((entry) => entry.id === settings.customMetricId); if (item === undefined || item.status !== "ok" || item.value === undefined) return undefined; const value = Number(item.value); return { label: item.id, value: Number.isFinite(value) ? value : 0, displayValue: item.value, unit: "" }; }
    default: return undefined;
  }
}

function rateMetric(label: string, bytes: number): SelectedMetric {
  if (bytes >= 1_000_000_000) return { label, value: bytes / 1_000_000_000, unit: "GB/s" };
  if (bytes >= 1_000_000) return { label, value: bytes / 1_000_000, unit: "MB/s" };
  return { label, value: bytes / 1_000, unit: "KB/s" };
}

function bytesMetric(label: string, bytes: number): SelectedMetric {
  if (bytes >= 1_000_000_000) return { label, value: bytes / 1_000_000_000, unit: "GB" };
  if (bytes >= 1_000_000) return { label, value: bytes / 1_000_000, unit: "MB" };
  if (bytes >= 1_000) return { label, value: bytes / 1_000, unit: "KB" };
  return { label, value: bytes, unit: "B" };
}
