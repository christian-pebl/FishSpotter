/**
 * Shared number formatting for /admin/metrics.
 *
 * The card headline, the chart axis and the hover readout all render the same
 * underlying value, so they format it in one place. Without this, a card
 * reading "31 min" above a chart whose tooltip says "30.6" looks like two
 * different numbers rather than two roundings of one.
 */

import type { MetricUnit } from "@/lib/metrics/series";

export function formatMetricValue(value: number | null, unit: MetricUnit): string {
  if (value == null || !Number.isFinite(value)) return "-";
  switch (unit) {
    case "percent":
      return `${Math.round(value)}%`;
    case "minutes":
      // Small averages need a decimal to move at all; totals in the thousands
      // do not, and a decimal there is just noise.
      return value >= 100
        ? `${Math.round(value).toLocaleString()} min`
        : `${value.toFixed(1)} min`;
    default:
      return Math.round(value).toLocaleString();
  }
}

/**
 * A daily average, which needs a decimal where a total does not: rounded to a
 * whole number, "1.2 sessions a day" and "1.8 sessions a day" both read "1".
 */
export function formatMetricAverage(value: number | null, unit: MetricUnit): string {
  if (value == null || !Number.isFinite(value)) return "-";
  if (unit === "count" && value < 100) return value.toFixed(1);
  return formatMetricValue(value, unit);
}

/** Axis labels are tighter than headlines: no unit suffix, k-abbreviated. */
export function formatAxisValue(value: number, unit: MetricUnit): string {
  if (unit === "percent") return `${Math.round(value)}%`;
  if (Math.abs(value) >= 10_000) return `${Math.round(value / 1000)}k`;
  if (Math.abs(value) >= 10 || Number.isInteger(value)) return Math.round(value).toLocaleString();
  return value.toFixed(1);
}

export interface MetricDelta {
  /** Signed percentage change, already formatted, e.g. "+18%". */
  text: string;
  direction: "up" | "down" | "flat";
  /** Screen-reader sentence, since the sign and colour are visual shorthand. */
  description: string;
}

/**
 * Change against the equal-length window before this one.
 *
 * Returns null when there is nothing honest to say: no previous window, an
 * undefined ratio on either side, or a previous value of zero with no current
 * activity either. Growth from a zero base is reported as "new" rather than as
 * an infinite percentage.
 */
export function metricDelta(current: number | null, previous: number | null): MetricDelta | null {
  if (current == null || previous == null) return null;
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) {
    if (current === 0) return null;
    return { text: "new", direction: "up", description: "up from none in the previous period" };
  }
  const change = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Math.round(change);
  if (rounded === 0) {
    return { text: "level", direction: "flat", description: "level with the previous period" };
  }
  const direction = rounded > 0 ? "up" : "down";
  return {
    text: `${rounded > 0 ? "+" : ""}${rounded}%`,
    direction,
    description: `${direction} ${Math.abs(rounded)} percent on the previous period`,
  };
}

/** "30 Aug 2026" from a `YYYY-MM-DD` day key, for tooltips and captions. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDayKey(day: string, opts: { withYear?: boolean } = {}): string {
  const [y, m, d] = day.split("-").map((p) => Number(p));
  if (!y || !m || !d) return day;
  const base = `${d} ${MONTHS[m - 1]}`;
  return opts.withYear ? `${base} ${y}` : base;
}

/**
 * A round number at or above `max`, for the top of a chart axis.
 *
 * The ladder is finer than the usual 1 / 2 / 5, because that one wastes a lot
 * of plot: a peak of 11 sessions gets an axis to 20, and nearly half the chart
 * is empty air above the data. Every rung here also halves into something a
 * reader recognises, since the middle gridline is drawn at half the top.
 */
const NICE_STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

export function niceCeiling(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  const normalised = max / magnitude;
  const step = NICE_STEPS.find((s) => normalised <= s) ?? 10;
  return step * magnitude;
}

/** The matching round number at or below `min`, for a line chart's baseline. */
export function niceFloor(min: number): number {
  if (!Number.isFinite(min) || min <= 0) return 0;
  const magnitude = Math.pow(10, Math.floor(Math.log10(min)));
  return Math.floor(min / magnitude) * magnitude;
}
