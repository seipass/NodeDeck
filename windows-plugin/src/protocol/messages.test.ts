import { describe, expect, it } from "vitest";
import { parseAgentMessage } from "./messages.js";

describe("parseAgentMessage", () => {
  it("accepts protocol errors", () => { expect(parseAgentMessage({ type: "error", code: "AUTH_FAILED" })).toEqual({ type: "error", code: "AUTH_FAILED" }); });
  it("rejects unknown messages", () => { expect(parseAgentMessage({ type: "unknown" })).toBeUndefined(); });
  it("rejects incomplete metrics payloads", () => { expect(parseAgentMessage({ type: "metrics", protocol: "streamdeck-monitor", version: 1, data: {} })).toBeUndefined(); });
  it("rejects malformed hello acknowledgements", () => { expect(parseAgentMessage({ type: "hello_ack", protocol: "streamdeck-monitor", version: 1, capabilities: [3] })).toBeUndefined(); });
  it("rejects malformed optional metric values", () => {
    expect(parseAgentMessage({ type: "metrics", protocol: "streamdeck-monitor", version: 1, timestamp: "2026-01-01T00:00:00Z", data: { cpu: { usagePercent: 1, cores: [], load1: 1, load5: 1, load15: 1 }, memory: { usedBytes: 1, availableBytes: 1, usedPercent: 1, swapUsedBytes: 1, swapUsedPercent: 1 }, network: [{ interface: "eth0", rxBytesPerSecond: "bad", txBytesPerSecond: 1, rxBytes: 1, txBytes: 1 }] } })).toBeUndefined();
  });
  it("rejects timestamps that are not RFC3339", () => {
    expect(parseAgentMessage({ type: "metrics", protocol: "streamdeck-monitor", version: 1, timestamp: "not-a-timestamp", data: { cpu: { usagePercent: 1, cores: [], load1: 1, load5: 1, load15: 1 }, memory: { usedBytes: 1, availableBytes: 1, usedPercent: 1, swapUsedBytes: 1, swapUsedPercent: 1 } } })).toBeUndefined();
  });
});
