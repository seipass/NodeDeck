import { describe, expect, it } from "vitest";
import { parseAgentMessage } from "./messages.js";

describe("parseAgentMessage", () => {
  it("accepts protocol errors", () => { expect(parseAgentMessage({ type: "error", code: "AUTH_FAILED" })).toEqual({ type: "error", code: "AUTH_FAILED" }); });
  it("rejects unknown messages", () => { expect(parseAgentMessage({ type: "unknown" })).toBeUndefined(); });
});
