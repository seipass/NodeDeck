import { describe, expect, it } from "vitest";
import { renderMetric } from "./metric-renderer.js";

describe("renderMetric", () => {
  it("renders online value and unit", () => { const svg = renderMetric("CPU", 42.5, "%", "online"); expect(svg).toContain("CPU"); expect(svg).toContain("42.5%"); });
  it("renders state instead of stale value offline", () => { const svg = renderMetric("CPU", 42.5, "%", "offline"); expect(svg).toContain("offline"); expect(svg).not.toContain("42.5%"); });
});
