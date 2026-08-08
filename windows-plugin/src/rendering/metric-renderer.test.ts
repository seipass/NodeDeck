import { describe, expect, it } from "vitest";
import { renderMetric } from "./metric-renderer.js";

describe("renderMetric", () => {
  it("renders online value and unit", () => { const svg = renderMetric({ label: "CPU", value: 42.5, unit: "%", decimalPlaces: 1 }, "online"); expect(svg).toContain("CPU"); expect(svg).toContain("42.5%"); });
  it("renders critical color at threshold", () => { expect(renderMetric({ label: "CPU", value: 95, unit: "%", decimalPlaces: 0, criticalThreshold: 90 }, "online")).toContain("#ef4444"); });
  it("renders state instead of stale value offline", () => { const svg = renderMetric({ label: "CPU", value: 42.5, unit: "%", decimalPlaces: 1 }, "offline"); expect(svg).toContain("offline"); expect(svg).not.toContain("42.5%"); });
});
