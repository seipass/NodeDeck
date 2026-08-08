import { describe, expect, it } from "vitest";
import { selectMetric } from "./selectors.js";
import type { MetricSnapshot } from "../protocol/messages.js";

const snapshot: MetricSnapshot = { type: "metrics", protocol: "streamdeck-monitor", version: 1, timestamp: "2026-01-01T00:00:00Z", data: { cpu: { usagePercent: 42.5, cores: [], load1: 1, load5: 2, load15: 3 }, memory: { usedBytes: 1, availableBytes: 2, usedPercent: 50, swapUsedBytes: 3, swapUsedPercent: 4 }, disks: [{ mountpoint: "/", usedBytes: 1, freeBytes: 2, usedPercent: 50, readBytesPerSecond: 3_000_000, writeBytesPerSecond: 4_000_000 }], network: [{ interface: "eth0", rxBytesPerSecond: 2_000_000, txBytesPerSecond: 5_000_000, rxBytes: 0, txBytes: 0 }], docker: [{ id: "abc", name: "web", state: "running", cpuPercent: 12.5, memoryUsageBytes: 2_000_000, uptimeSeconds: 65 }] } };

describe("selectMetric", () => {
  it("selects CPU usage", () => { expect(selectMetric(snapshot, { metricType: "cpu" })).toEqual({ label: "CPU", value: 42.5, unit: "%" }); });
  it("formats network rate in MB/s", () => { expect(selectMetric(snapshot, { metricType: "network", device: "eth0" })).toEqual({ label: "eth0", value: 2, unit: "MB/s" }); });
  it("selects load, swap, disk I/O, and upload metrics", () => {
    expect(selectMetric(snapshot, { metricType: "cpu-load1" })).toEqual({ label: "LOAD 1m", value: 1, unit: "" });
    expect(selectMetric(snapshot, { metricType: "memory-swap" })).toEqual({ label: "SWAP", value: 4, unit: "%" });
    expect(selectMetric(snapshot, { metricType: "disk-read", device: "/" })).toEqual({ label: "/ R", value: 3, unit: "MB/s" });
    expect(selectMetric(snapshot, { metricType: "disk-write", device: "/" })).toEqual({ label: "/ W", value: 4, unit: "MB/s" });
    expect(selectMetric(snapshot, { metricType: "network-upload", device: "eth0" })).toEqual({ label: "eth0 TX", value: 5, unit: "MB/s" });
  });
  it("selects docker CPU", () => { expect(selectMetric(snapshot, { metricType: "docker-cpu", device: "web" })).toEqual({ label: "web", value: 12.5, unit: "%" }); });
  it("selects docker memory and uptime", () => {
    expect(selectMetric(snapshot, { metricType: "docker-memory", device: "web" })).toEqual({ label: "web", value: 2, unit: "MB" });
    expect(selectMetric(snapshot, { metricType: "docker-uptime", device: "web" })).toEqual({ label: "web", value: 65, unit: "s" });
  });
  it("preserves nonnumeric custom metric output for display", () => {
    const customSnapshot: MetricSnapshot = { ...snapshot, data: { ...snapshot.data, custom: [{ id: "status", status: "ok", value: "online", exitCode: 0 }] } };
    expect(selectMetric(customSnapshot, { metricType: "custom", customMetricId: "status" })).toEqual({ label: "status", value: 0, displayValue: "online", unit: "" });
  });
  it("bounds custom display text without changing numeric selection", () => {
    const customSnapshot: MetricSnapshot = { ...snapshot, data: { ...snapshot.data, custom: [{ id: "status", status: "ok", value: "  one\n two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen  ", exitCode: 0 }] } };
    const selected = selectMetric(customSnapshot, { metricType: "custom", customMetricId: "status" });
    expect(selected?.value).toBe(0);
    expect(selected?.displayValue).toHaveLength(48);
    expect(selected?.displayValue).not.toContain("\n");
  });
});
