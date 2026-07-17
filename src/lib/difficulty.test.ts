import { describe, expect, it } from "vitest";
import {
  bandForScore,
  bandWeightsForReadiness,
  readinessFromAnsweredCount,
  weightedBandOrder,
  RAMP_CLIPS,
} from "./difficulty";
import { hashStringToSeed, mulberry32 } from "./shuffle";

describe("bandForScore", () => {
  it("classifies the three bands at their boundaries", () => {
    expect(bandForScore(1)).toBe("easy");
    expect(bandForScore(2 / 3)).toBe("easy");
    expect(bandForScore(0.6)).toBe("medium");
    expect(bandForScore(1 / 3)).toBe("medium");
    expect(bandForScore(0.3)).toBe("hard");
    expect(bandForScore(0)).toBe("hard");
  });
});

describe("readinessFromAnsweredCount", () => {
  it("is 0 for a brand-new spotter", () => {
    expect(readinessFromAnsweredCount(0)).toBe(0);
    expect(readinessFromAnsweredCount(-1)).toBe(0);
  });

  it("ramps linearly up to RAMP_CLIPS", () => {
    expect(readinessFromAnsweredCount(RAMP_CLIPS / 2)).toBeCloseTo(0.5);
  });

  it("caps at 1 once ramped", () => {
    expect(readinessFromAnsweredCount(RAMP_CLIPS)).toBe(1);
    expect(readinessFromAnsweredCount(RAMP_CLIPS * 10)).toBe(1);
  });
});

describe("bandWeightsForReadiness", () => {
  it("favours easy heavily at readiness 0", () => {
    const w = bandWeightsForReadiness(0);
    expect(w.easy).toBeGreaterThan(w.medium);
    expect(w.medium).toBeGreaterThan(w.hard);
  });

  it("favours hard most at readiness 1", () => {
    const w = bandWeightsForReadiness(1);
    expect(w.hard).toBeGreaterThan(w.medium);
    expect(w.hard).toBeGreaterThan(w.easy);
  });

  it("always sums to ~1 (a valid weight distribution)", () => {
    for (const r of [0, 0.25, 0.5, 0.75, 1]) {
      const w = bandWeightsForReadiness(r);
      expect(w.easy + w.medium + w.hard).toBeCloseTo(1, 5);
    }
  });

  it("clamps out-of-range readiness", () => {
    expect(bandWeightsForReadiness(-1)).toEqual(bandWeightsForReadiness(0));
    expect(bandWeightsForReadiness(2)).toEqual(bandWeightsForReadiness(1));
  });
});

describe("weightedBandOrder", () => {
  const item = (id: string, difficultyScore: number) => ({ id, difficultyScore });

  it("returns every item exactly once, never duplicated or dropped", () => {
    const items = [
      item("e1", 0.9),
      item("e2", 0.8),
      item("m1", 0.5),
      item("m2", 0.4),
      item("h1", 0.1),
      item("h2", 0.05),
    ];
    const rng = mulberry32(hashStringToSeed("seed-1"));
    const result = weightedBandOrder(items, bandWeightsForReadiness(0), rng);
    expect(result).toHaveLength(items.length);
    expect(new Set(result.map((r) => r.id)).size).toBe(items.length);
  });

  it("is deterministic for the same rng sequence", () => {
    const items = [item("a", 0.9), item("b", 0.5), item("c", 0.1), item("d", 0.6)];
    const r1 = weightedBandOrder(items, bandWeightsForReadiness(0.3), mulberry32(hashStringToSeed("x")));
    const r2 = weightedBandOrder(items, bandWeightsForReadiness(0.3), mulberry32(hashStringToSeed("x")));
    expect(r1.map((r) => r.id)).toEqual(r2.map((r) => r.id));
  });

  it("skews easy clips toward the front for a brand-new spotter", () => {
    // 3 easy, 3 medium, 3 hard, repeated across many seeds — at readiness 0
    // the average position of easy items should be earlier than hard items.
    const items = [
      item("e1", 0.95), item("e2", 0.9), item("e3", 0.85),
      item("m1", 0.6), item("m2", 0.55), item("m3", 0.5),
      item("h1", 0.2), item("h2", 0.15), item("h3", 0.1),
    ];
    const weights = bandWeightsForReadiness(0);

    let easySum = 0;
    let hardSum = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
      const rng = mulberry32(hashStringToSeed(`trial-${i}`));
      const result = weightedBandOrder(items, weights, rng);
      const indexOf = (id: string) => result.findIndex((r) => r.id === id);
      easySum += indexOf("e1") + indexOf("e2") + indexOf("e3");
      hardSum += indexOf("h1") + indexOf("h2") + indexOf("h3");
    }
    expect(easySum / trials).toBeLessThan(hardSum / trials);
  });

  it("skews hard clips toward the front once fully ramped", () => {
    const items = [
      item("e1", 0.95), item("e2", 0.9), item("e3", 0.85),
      item("m1", 0.6), item("m2", 0.55), item("m3", 0.5),
      item("h1", 0.2), item("h2", 0.15), item("h3", 0.1),
    ];
    const weights = bandWeightsForReadiness(1);

    let easySum = 0;
    let hardSum = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
      const rng = mulberry32(hashStringToSeed(`trial-${i}`));
      const result = weightedBandOrder(items, weights, rng);
      const indexOf = (id: string) => result.findIndex((r) => r.id === id);
      easySum += indexOf("e1") + indexOf("e2") + indexOf("e3");
      hardSum += indexOf("h1") + indexOf("h2") + indexOf("h3");
    }
    expect(hardSum / trials).toBeLessThan(easySum / trials);
  });

  it("handles an empty list", () => {
    const rng = mulberry32(hashStringToSeed("seed"));
    expect(weightedBandOrder([], bandWeightsForReadiness(0), rng)).toEqual([]);
  });

  it("handles a single band only (all items the same band)", () => {
    const items = [item("a", 0.9), item("b", 0.95), item("c", 0.85)];
    const rng = mulberry32(hashStringToSeed("seed"));
    const result = weightedBandOrder(items, bandWeightsForReadiness(0), rng);
    expect(result).toHaveLength(3);
    expect(new Set(result.map((r) => r.id)).size).toBe(3);
  });
});
