import { describe, expect, it } from "vitest";
import { parseConnectionSettings } from "./settings.js";

describe("parseConnectionSettings", () => {
  it("normalizes a valid host and port", () => {
    expect(parseConnectionSettings({ host: "  server01 ", port: 8765, token: "secret" })).toEqual({ host: "server01", port: 8765, token: "secret" });
  });
  it("rejects invalid host and port values", () => {
    expect(parseConnectionSettings({ host: "server/name", port: 8765 })).toBeUndefined();
    expect(parseConnectionSettings({ host: "server01", port: 0 })).toBeUndefined();
    expect(parseConnectionSettings({ host: "server01", port: 65536 })).toBeUndefined();
  });
});
