/**
 * Google's Core Web Vitals bands, the same ones `web-vitals` uses in the
 * browser: a value up to and including the first bound is "good", one above
 * the second bound is "poor", anything between is "needs-improvement"
 * (`getRating` in web-vitals' bindReporter). Plain numbers here so server code
 * (the /api/vitals route, the stats roundup, the CLI) can rate a stored value
 * without importing a browser library. `web-vitals-rating.test.ts` fails if
 * they drift from the thresholds the installed `web-vitals` exports.
 *
 * Why this exists: until 24 Nov 2026 neither the reporter nor the route stored
 * a rating, so every `Vital` row has `rating` null and the roundup read
 * "good 0 of N". New rows now carry a rating; `tallyVitals` rates the old
 * null rows from their value so they count too.
 */

export const VITAL_RATINGS = ["good", "needs-improvement", "poor"] as const;
export type VitalRating = (typeof VITAL_RATINGS)[number];

/** [good up to and including, poor above]. LCP, INP, FCP, TTFB in ms; CLS unitless. */
export const VITAL_THRESHOLDS: Readonly<Record<string, readonly [number, number]>> = {
  LCP: [2500, 4000],
  INP: [200, 500],
  CLS: [0.1, 0.25],
  FCP: [1800, 3000],
  TTFB: [800, 1800],
};

/** Rate a metric value, or null for a metric name with no known bands. */
export function rateVital(name: string, value: number): VitalRating | null {
  // Own-property check, so a name like "constructor" is unknown, not "good".
  if (!Object.prototype.hasOwnProperty.call(VITAL_THRESHOLDS, name)) return null;
  if (!Number.isFinite(value)) return null;
  const [good, poor] = VITAL_THRESHOLDS[name];
  if (value > poor) return "poor";
  if (value > good) return "needs-improvement";
  return "good";
}

export interface VitalTally {
  good: number;
  total: number;
}

/**
 * Per-metric "good of total". `rated` is a group-by over rows that carry a
 * rating; `unrated` is the rows whose rating is null, rated here from their
 * value. A metric with no known bands still counts towards its total.
 */
export function tallyVitals(
  rated: ReadonlyArray<{ name: string; rating: string | null; count: number }>,
  unrated: ReadonlyArray<{ name: string; value: number }>,
): Record<string, VitalTally> {
  const out: Record<string, VitalTally> = {};
  const add = (name: string, rating: string | null, count: number) => {
    const e = (out[name] ??= { good: 0, total: 0 });
    e.total += count;
    if (rating === "good") e.good += count;
  };
  for (const g of rated) add(g.name, g.rating, g.count);
  for (const r of unrated) add(r.name, rateVital(r.name, r.value), 1);
  return out;
}
