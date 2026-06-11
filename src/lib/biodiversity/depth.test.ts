import { describe, it, expect } from "vitest";
import { summariseDepths, depthOfRecord } from "./depth";

describe("summariseDepths", () => {
  it("returns null below the minimum useful reading count", () => {
    expect(summariseDepths([5, 6, 7])).toBeNull();
    expect(summariseDepths([])).toBeNull();
  });

  it("drops out-of-range readings (negative / absurd) before counting", () => {
    // 7 valid + 3 junk = 7 valid, still below the floor of 8 -> null
    expect(summariseDepths([5, 6, 7, 8, 9, 10, 11, -3, 99999, NaN])).toBeNull();
  });

  it("computes median and the p10-p90 typical band", () => {
    const xs = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
    const s = summariseDepths(xs)!;
    expect(s).not.toBeNull();
    expect(s.n).toBe(10);
    expect(s.minM).toBe(2);
    expect(s.maxM).toBe(20);
    expect(s.medianM).toBeCloseTo(11, 5);
    // p10 of 10 sorted points (linear interp) = index 0.9 -> 2 + (4-2)*0.9 = 3.8
    expect(s.p10M).toBeCloseTo(3.8, 5);
    // p90 -> index 8.1 -> 18 + (20-18)*0.1 = 18.2
    expect(s.p90M).toBeCloseTo(18.2, 5);
  });

  it("labels a band, rounding to 1 m below 30 m", () => {
    const s = summariseDepths([2, 4, 6, 8, 10, 12, 14, 16, 18, 20])!;
    expect(s.label).toBe("4-18 m");
  });

  it("rounds to 5 m steps above 30 m", () => {
    const deep = [40, 60, 80, 100, 120, 140, 160, 180, 200, 220];
    const s = summariseDepths(deep)!;
    // p10 = 58 -> 60, p90 = 202 -> 200 (rounded to 5 m steps above 30 m)
    expect(s.label).toBe("60-200 m");
  });

  it("uses a ~single label when the band collapses", () => {
    const flat = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
    const s = summariseDepths(flat)!;
    expect(s.label).toBe("~10 m");
  });
});

describe("depthOfRecord precedence", () => {
  it("prefers a measured depth", () => {
    expect(depthOfRecord({ depth: 12, minimumDepthInMeters: 0, maximumDepthInMeters: 50 })).toBe(12);
  });
  it("averages min/max when no depth", () => {
    expect(depthOfRecord({ minimumDepthInMeters: 10, maximumDepthInMeters: 30 })).toBe(20);
  });
  it("falls back to a single bound, then bathymetry", () => {
    expect(depthOfRecord({ minimumDepthInMeters: 15 })).toBe(15);
    expect(depthOfRecord({ maximumDepthInMeters: 25 })).toBe(25);
    expect(depthOfRecord({ bathymetry: 40 })).toBe(40);
  });
  it("returns null when nothing usable", () => {
    expect(depthOfRecord({})).toBeNull();
    expect(depthOfRecord({ depth: null, bathymetry: null })).toBeNull();
  });
});
