import { describe, expect, it } from "vitest";
import { MetricStore } from "./metric-store.js";
import type { MetricSnapshot } from "../protocol/messages.js";

const snapshot: MetricSnapshot = { type: "metrics", protocol: "streamdeck-monitor", version: 1, timestamp: "2026-01-01T00:00:00Z", data: { cpu: { usagePercent: 10, cores: [], load1: 1, load5: 1, load15: 1 }, memory: { usedBytes: 1, availableBytes: 2, usedPercent: 3, swapUsedBytes: 0, swapUsedPercent: 0 } } };

describe("MetricStore", () => {
  it("stores and publishes the latest snapshot", () => {
    const store = new MetricStore();
    const received: MetricSnapshot[] = [];
    const unsubscribe = store.on((value) => received.push(value));
    store.update(snapshot);
    unsubscribe();
    store.update({ ...snapshot, timestamp: "2026-01-01T00:00:01Z" });
    expect(store.get()?.timestamp).toBe("2026-01-01T00:00:01Z");
    expect(received).toHaveLength(1);
  });
});
