import { describe, expect, it } from "vitest";
import {
  formatAxisValue,
  formatDayKey,
  formatMetricAverage,
  formatMetricValue,
  metricDelta,
  niceCeiling,
  niceFloor,
} from "./format";

describe("formatMetricValue", () => {
  it("groups counts and drops the decimals", () => {
    expect(formatMetricValue(1913, "count")).toBe("1,913");
    expect(formatMetricValue(0, "count")).toBe("0");
  });

  it("keeps a decimal on small minute figures and drops it on large ones", () => {
    // A per-session average of 30.6 has to move; a 1,752-minute total does not.
    expect(formatMetricValue(30.6, "minutes")).toBe("30.6 min");
    expect(formatMetricValue(1752.4, "minutes")).toBe("1,752 min");
  });

  it("rounds percentages to whole points", () => {
    expect(formatMetricValue(66.67, "percent")).toBe("67%");
  });

  it("shows a dash rather than a zero for an undefined value", () => {
    expect(formatMetricValue(null, "count")).toBe("-");
    expect(formatMetricValue(Number.NaN, "percent")).toBe("-");
    expect(formatMetricValue(Number.POSITIVE_INFINITY, "minutes")).toBe("-");
  });
});

describe("formatAxisValue", () => {
  it("abbreviates large counts", () => {
    expect(formatAxisValue(12000, "count")).toBe("12k");
    expect(formatAxisValue(950, "count")).toBe("950");
  });

  it("keeps one decimal on a small fractional tick", () => {
    expect(formatAxisValue(2.5, "count")).toBe("2.5");
  });

  it("suffixes percentages", () => {
    expect(formatAxisValue(50, "percent")).toBe("50%");
  });
});

describe("metricDelta", () => {
  it("reports a rise and a fall with the sign carrying the meaning", () => {
    expect(metricDelta(120, 100)?.text).toBe("+20%");
    expect(metricDelta(120, 100)?.direction).toBe("up");
    expect(metricDelta(80, 100)?.text).toBe("-20%");
    expect(metricDelta(80, 100)?.direction).toBe("down");
  });

  it("calls an unchanged figure level rather than +0%", () => {
    const delta = metricDelta(100, 100);
    expect(delta?.text).toBe("level");
    expect(delta?.direction).toBe("flat");
  });

  it("says 'new' instead of an infinite percentage when the base was zero", () => {
    expect(metricDelta(7, 0)?.text).toBe("new");
  });

  it("says nothing at all when both periods are empty", () => {
    expect(metricDelta(0, 0)).toBeNull();
  });

  it("says nothing when either side is undefined", () => {
    expect(metricDelta(10, null)).toBeNull();
    expect(metricDelta(null, 10)).toBeNull();
    expect(metricDelta(10, Number.NaN)).toBeNull();
  });

  it("carries a spoken description, since the sign and colour are visual only", () => {
    expect(metricDelta(80, 100)?.description).toBe("down 20 percent on the previous period");
  });
});

describe("formatMetricAverage", () => {
  it("keeps a decimal, so 1.2 a day and 1.8 a day do not both read as 1", () => {
    expect(formatMetricAverage(1.18, "count")).toBe("1.2");
    expect(formatMetricAverage(1.82, "count")).toBe("1.8");
  });

  it("drops the decimal once the number is big enough not to need it", () => {
    expect(formatMetricAverage(432.6, "count")).toBe("433");
  });

  it("leaves minutes and percentages to the ordinary formatter", () => {
    expect(formatMetricAverage(30.62, "minutes")).toBe("30.6 min");
    expect(formatMetricAverage(66.7, "percent")).toBe("67%");
  });

  it("shows a dash for an undefined average", () => {
    expect(formatMetricAverage(null, "count")).toBe("-");
  });
});

describe("niceCeiling", () => {
  it("finds a round top close above the peak instead of a wasteful one", () => {
    // A peak of 11 on a 1/2/5 ladder gets an axis to 20, leaving nearly half
    // the plot empty. The finer ladder tops it at 12.
    expect(niceCeiling(11)).toBe(12);
    expect(niceCeiling(7)).toBe(8);
    expect(niceCeiling(43)).toBe(50);
    expect(niceCeiling(120)).toBe(120);
    expect(niceCeiling(1)).toBe(1);
  });

  it("halves into a readable middle gridline at every rung", () => {
    for (const peak of [3, 7, 11, 43, 120, 443, 1913]) {
      const top = niceCeiling(peak);
      expect(top).toBeGreaterThanOrEqual(peak);
      expect(Number.isInteger((top / 2) * 100)).toBe(true);
    }
  });

  it("never returns zero, so an empty chart still has an axis", () => {
    expect(niceCeiling(0)).toBe(1);
    expect(niceCeiling(-5)).toBe(1);
    expect(niceCeiling(Number.NaN)).toBe(1);
  });
});

describe("niceFloor", () => {
  it("rounds down to the decade step", () => {
    expect(niceFloor(55)).toBe(50);
    expect(niceFloor(89)).toBe(80);
    expect(niceFloor(1234)).toBe(1000);
  });

  it("floors at zero", () => {
    expect(niceFloor(0)).toBe(0);
    expect(niceFloor(-3)).toBe(0);
  });
});

describe("formatDayKey", () => {
  it("reads as a date, with the year only when asked", () => {
    expect(formatDayKey("2026-08-30")).toBe("30 Aug");
    expect(formatDayKey("2026-08-30", { withYear: true })).toBe("30 Aug 2026");
  });

  it("passes anything unparseable straight through", () => {
    expect(formatDayKey("")).toBe("");
  });
});
