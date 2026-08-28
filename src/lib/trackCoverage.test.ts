import { describe, expect, it } from "vitest";
import {
  coverageAlpha,
  inCoverage,
  trackCoverage,
  TRACK_FADE_FRACTION,
} from "./trackCoverage";

const F = TRACK_FADE_FRACTION;

describe("trackCoverage", () => {
  it("returns null for an empty track", () => {
    expect(trackCoverage([])).toBeNull();
  });

  it("returns null when points carry no t_norm (pre-re-cut clips)", () => {
    // The 106 clips never re-cut have no stamps; they must keep the original
    // stretch-across-the-whole-clip behaviour, which null selects.
    expect(trackCoverage([{}, {}, {}])).toBeNull();
  });

  it("returns null when only some points are stamped", () => {
    expect(trackCoverage([{ t_norm: 0.2 }, {}])).toBeNull();
  });

  it("reads the window off the first and last stamps", () => {
    expect(
      trackCoverage([{ t_norm: 0.25 }, { t_norm: 0.5 }, { t_norm: 0.75 }]),
    ).toEqual({ start: 0.25, end: 0.75 });
  });

  it("returns null for a zero-length or inverted window", () => {
    expect(trackCoverage([{ t_norm: 0.4 }, { t_norm: 0.4 }])).toBeNull();
    expect(trackCoverage([{ t_norm: 0.6 }, { t_norm: 0.3 }])).toBeNull();
  });
});

describe("coverageAlpha", () => {
  const cov = { start: 0.3, end: 0.7 };

  it("is fully opaque with no coverage, so old clips are untouched", () => {
    expect(coverageAlpha(0, null)).toBe(1);
    expect(coverageAlpha(0.5, null)).toBe(1);
    expect(coverageAlpha(1, null)).toBe(1);
  });

  it("is fully opaque throughout the tracked window", () => {
    expect(coverageAlpha(0.3, cov)).toBe(1);
    expect(coverageAlpha(0.5, cov)).toBe(1);
    expect(coverageAlpha(0.7, cov)).toBe(1);
  });

  it("is fully transparent well outside the window", () => {
    expect(coverageAlpha(0, cov)).toBe(0);
    expect(coverageAlpha(1, cov)).toBe(0);
  });

  it("ramps in over the fade window before the track starts", () => {
    expect(coverageAlpha(cov.start - F, cov)).toBeCloseTo(0, 6);
    expect(coverageAlpha(cov.start - F / 2, cov)).toBeCloseTo(0.5, 6);
  });

  it("ramps out over the fade window after the track ends", () => {
    expect(coverageAlpha(cov.end + F, cov)).toBeCloseTo(0, 6);
    expect(coverageAlpha(cov.end + F / 2, cov)).toBeCloseTo(0.5, 6);
  });

  it("never returns a value outside 0..1", () => {
    for (let p = -0.5; p <= 1.5; p += 0.01) {
      const a = coverageAlpha(p, cov);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
    }
  });

  it("is monotonic rising into the window and falling out of it", () => {
    // A fade that is not monotonic reads as a flicker, not a fade.
    let prev = -1;
    for (let p = cov.start - F; p <= cov.start; p += F / 20) {
      const a = coverageAlpha(p, cov);
      expect(a).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = a;
    }
    prev = 2;
    for (let p = cov.end; p <= cov.end + F; p += F / 20) {
      const a = coverageAlpha(p, cov);
      expect(a).toBeLessThanOrEqual(prev + 1e-9);
      prev = a;
    }
  });

  it("handles a window whose fade would run past the clip edges", () => {
    // A track starting at the very first frame has no room to fade in; it must
    // simply be opaque rather than producing a negative or NaN alpha.
    const edge = { start: 0, end: 1 };
    expect(coverageAlpha(0, edge)).toBe(1);
    expect(coverageAlpha(1, edge)).toBe(1);
  });
});

describe("inCoverage", () => {
  it("is always true without coverage", () => {
    expect(inCoverage(0, null)).toBe(true);
    expect(inCoverage(1, null)).toBe(true);
  });

  it("is true inside and false outside, inclusive at the edges", () => {
    const cov = { start: 0.3, end: 0.7 };
    expect(inCoverage(0.29, cov)).toBe(false);
    expect(inCoverage(0.3, cov)).toBe(true);
    expect(inCoverage(0.7, cov)).toBe(true);
    expect(inCoverage(0.71, cov)).toBe(false);
  });
});
