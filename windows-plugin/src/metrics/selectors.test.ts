import { describe, expect, it } from "vitest";
import { selectMetric } from "./selectors.js";
import type { MetricSnapshot } from "../protocol/messages.js";

const snapshot: MetricSnapshot = { type: "metrics", protocol: "streamdeck-monitor", version: 1, timestamp: "2026-01-01T00:00:00Z", data: { cpu: { usagePercent: 42.5, cores: [], load1: 1, load5: 2, load15: 3 }, memory: { usedBytes: 1, availableBytes: 2, usedPercent: 50 }, network: [{ interface: "eth0", rxBytesPerSecond: 2_000_000, txBytesPerSecond: 0, rxBytes: 0, txBytes: 0 }] } };

describe("selectMetric", () => {
  it("selects CPU usage", () => { expect(selectMetric(snapshot, { metricType: "cpu" })).toEqual({ label: "CPU", value: 42.5, unit: "%" }); });
  it("formats network rate in MB/s", () => { expect(selectMetric(snapshot, { metricType: "network", device: "eth0" })).toEqual({ label: "eth0", value: 2, unit: "MB/s" }); });
});
