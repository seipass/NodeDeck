import { describe, expect, it } from "vitest";
import { parseAgentMessage } from "./messages.js";

describe("parseAgentMessage", () => {
  it("accepts protocol errors", () => { expect(parseAgentMessage({ type: "error", code: "AUTH_FAILED" })).toEqual({ type: "error", code: "AUTH_FAILED" }); });
  it("rejects unknown messages", () => { expect(parseAgentMessage({ type: "unknown" })).toBeUndefined(); });
  it("rejects incomplete metrics payloads", () => { expect(parseAgentMessage({ type: "metrics", protocol: "streamdeck-monitor", version: 1, data: {} })).toBeUndefined(); });
  it("rejects malformed hello acknowledgements", () => { expect(parseAgentMessage({ type: "hello_ack", protocol: "streamdeck-monitor", version: 1, capabilities: [3] })).toBeUndefined(); });
});
