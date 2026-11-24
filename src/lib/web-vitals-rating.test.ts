import { describe, expect, it } from "vitest";
import {
  CLSThresholds,
  FCPThresholds,
  INPThresholds,
  LCPThresholds,
  TTFBThresholds,
} from "web-vitals";
import { VITAL_THRESHOLDS, rateVital, tallyVitals } from "./web-vitals-rating";

describe("VITAL_THRESHOLDS", () => {
  it("matches the bands the installed web-vitals rates with", () => {
    // If a web-vitals upgrade moves a band, the browser's rating and the
    // server's would disagree; this fails first.
    expect(VITAL_THRESHOLDS).toEqual({
      LCP: LCPThresholds,
      INP: INPThresholds,
      CLS: CLSThresholds,
      FCP: FCPThresholds,
      TTFB: TTFBThresholds,
    });
  });
});

describe("rateVital", () => {
  it("counts a value on the good bound as good, as web-vitals does", () => {
    expect(rateVital("LCP", 2500)).toBe("good");
    expect(rateVital("LCP", 2500.1)).toBe("needs-improvement");
    expect(rateVital("INP", 200)).toBe("good");
    expect(rateVital("CLS", 0.1)).toBe("good");
  });

  it("counts a value on the poor bound as needs-improvement, and above it as poor", () => {
    expect(rateVital("LCP", 4000)).toBe("needs-improvement");
    expect(rateVital("LCP", 4001)).toBe("poor");
    expect(rateVital("INP", 500)).toBe("needs-improvement");
    expect(rateVital("INP", 501)).toBe("poor");
    expect(rateVital("CLS", 0.25)).toBe("needs-improvement");
    expect(rateVital("CLS", 0.26)).toBe("poor");
  });

  it("rates the production 75th percentiles of 24 Nov 2026 as needs-improvement", () => {
    expect(rateVital("LCP", 2988)).toBe("needs-improvement");
    expect(rateVital("INP", 256)).toBe("needs-improvement");
    expect(rateVital("CLS", 0.191)).toBe("needs-improvement");
  });

  it("returns null for a metric with no bands, including Object.prototype names", () => {
    expect(rateVital("FID", 10)).toBeNull();
    expect(rateVital("constructor", 0)).toBeNull();
    expect(rateVital("toString", 0)).toBeNull();
  });

  it("returns null for a value that is not a finite number", () => {
    expect(rateVital("LCP", Number.NaN)).toBeNull();
    expect(rateVital("LCP", Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("tallyVitals", () => {
  it("rates rows stored without a rating from their value", () => {
    // The state on 24 Nov 2026: every row has rating null, which the old
    // tally read as "good 0 of N".
    const tally = tallyVitals(
      [],
      [
        { name: "LCP", value: 1800 },
        { name: "LCP", value: 2988 },
        { name: "LCP", value: 5200 },
        { name: "INP", value: 120 },
        { name: "CLS", value: 0.02 },
        { name: "CLS", value: 0.191 },
      ],
    );
    expect(tally).toEqual({
      LCP: { good: 1, total: 3 },
      INP: { good: 1, total: 1 },
      CLS: { good: 1, total: 2 },
    });
  });

  it("adds rated groups and unrated rows into one count per metric", () => {
    const tally = tallyVitals(
      [
        { name: "LCP", rating: "good", count: 10 },
        { name: "LCP", rating: "poor", count: 2 },
        { name: "INP", rating: "needs-improvement", count: 4 },
      ],
      [
        { name: "LCP", value: 900 },
        { name: "INP", value: 150 },
      ],
    );
    expect(tally).toEqual({
      LCP: { good: 11, total: 13 },
      INP: { good: 1, total: 5 },
    });
  });

  it("counts a metric with no bands in its total but never as good", () => {
    expect(tallyVitals([], [{ name: "FID", value: 1 }])).toEqual({
      FID: { good: 0, total: 1 },
    });
  });
});
