/**
 * The date range an /admin/metrics view is scoped to.
 *
 * One module owns range parsing so the screen, its per-day charts and the CSV
 * export can never disagree about which days they are talking about. The range
 * lives in the URL (`?range=90d`, or `?range=custom&from=...&to=...`), which
 * means the server renders the correct view first time: there is no mount
 * effect that corrects the range after paint, and an admin can bookmark or
 * share a view.
 *
 * Days are UTC calendar days, matching the `toISOString().slice(0, 10)` bucket
 * the CSV export has always used. Presets are calendar days INCLUSIVE of today,
 * not a rolling N x 24h window, so a card's headline is exactly the sum of the
 * bars in its own chart. A rolling window would leave part of the oldest day
 * outside the range and the two would disagree by a few counts, which reads as
 * a bug rather than as a definition.
 */

export const METRIC_RANGE_PRESETS = ["7d", "30d", "90d", "12m", "all", "custom"] as const;
export type MetricRangePreset = (typeof METRIC_RANGE_PRESETS)[number];

/** Narrow literal so the fallback can be handed straight to `presetStart`. */
const DEFAULT_PRESET = "30d" as const;
export const DEFAULT_METRIC_RANGE: MetricRangePreset = DEFAULT_PRESET;

/**
 * Hard ceiling on how many days one view may span. The series loader reads raw
 * rows and buckets them in memory, so an unbounded range is the one way this
 * page could fall over. Three years is far beyond any funder report and well
 * inside the serverless budget at this app's volume.
 */
export const MAX_RANGE_DAYS = 1096;

/** Preset lengths in calendar days, inclusive of today. */
const PRESET_DAYS: Record<Exclude<MetricRangePreset, "all" | "custom">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "12m": 365,
};

export interface MetricRange {
  preset: MetricRangePreset;
  /** Start of the first day, UTC midnight. */
  from: Date;
  /** Start of the day AFTER the last day. Half-open: [from, toExclusive). */
  toExclusive: Date;
  /** Every UTC day key in the range, ascending. Charts are aligned to this. */
  days: string[];
  /** Human label for the resolved span, e.g. "1 - 30 Aug 2026". */
  label: string;
  /** True when the requested range was invalid or too long and we fell back. */
  coerced: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** UTC midnight at the start of the day `d` falls in. */
export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Parse a `YYYY-MM-DD` day key to its UTC midnight, or null if it isn't one. */
export function parseDayKey(value: string | undefined | null): Date | null {
  if (!value || !DATE_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  // Rejects real-looking but impossible dates: "2026-02-31" parses, then rolls
  // over into March, so the round-trip no longer matches what was asked for.
  return dayKey(d) === value ? d : null;
}

/** Every UTC day key from `from` up to (not including) `toExclusive`. */
export function dayKeysBetween(from: Date, toExclusive: Date): string[] {
  const keys: string[] = [];
  for (let t = from.getTime(); t < toExclusive.getTime(); t += DAY_MS) {
    keys.push(dayKey(new Date(t)));
  }
  return keys;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "1 - 30 Aug 2026", collapsing a repeated month and year where it reads better. */
export function formatRangeLabel(from: Date, lastDay: Date): string {
  const sameYear = from.getUTCFullYear() === lastDay.getUTCFullYear();
  const sameMonth = sameYear && from.getUTCMonth() === lastDay.getUTCMonth();
  const end = `${lastDay.getUTCDate()} ${MONTHS[lastDay.getUTCMonth()]} ${lastDay.getUTCFullYear()}`;
  if (sameMonth && from.getUTCDate() === lastDay.getUTCDate()) return end;
  if (sameMonth) return `${from.getUTCDate()} - ${end}`;
  const start = sameYear
    ? `${from.getUTCDate()} ${MONTHS[from.getUTCMonth()]}`
    : `${from.getUTCDate()} ${MONTHS[from.getUTCMonth()]} ${from.getUTCFullYear()}`;
  return `${start} - ${end}`;
}

export interface ParseRangeOptions {
  /** Override "now" for deterministic tests. */
  now?: Date;
  /**
   * Oldest row the app holds, the floor for the "all" preset. Null means there
   * is nothing yet, in which case "all" collapses to today.
   */
  earliest?: Date | null;
}

type RawParams = Record<string, string | string[] | undefined>;

function one(params: RawParams, key: string): string | undefined {
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Resolve `?range` / `?from` / `?to` into a concrete span.
 *
 * Never throws. An admin who fat-fingers a URL should land on the default view
 * with `coerced` set, not on a 500.
 */
export function parseMetricRange(params: RawParams, opts: ParseRangeOptions = {}): MetricRange {
  const now = opts.now ?? new Date();
  const today = startOfUtcDay(now);
  const tomorrow = new Date(today.getTime() + DAY_MS);

  const requested = one(params, "range");
  const preset = (METRIC_RANGE_PRESETS as readonly string[]).includes(requested ?? "")
    ? (requested as MetricRangePreset)
    : DEFAULT_METRIC_RANGE;
  const badPreset = requested != null && requested !== preset;

  if (preset === "custom") {
    const from = parseDayKey(one(params, "from"));
    const rawTo = parseDayKey(one(params, "to"));
    if (from && rawTo && from.getTime() <= rawTo.getTime()) {
      // A range running past today is clamped rather than rejected: it is a
      // reasonable thing to ask for ("this month") and the future days would
      // only ever be empty bars.
      const lastDay = rawTo.getTime() > today.getTime() ? today : rawTo;
      let start = from;
      let coerced = badPreset || lastDay.getTime() !== rawTo.getTime();
      const span = Math.round((lastDay.getTime() - start.getTime()) / DAY_MS) + 1;
      if (span > MAX_RANGE_DAYS) {
        start = new Date(lastDay.getTime() - (MAX_RANGE_DAYS - 1) * DAY_MS);
        coerced = true;
      }
      if (start.getTime() > lastDay.getTime()) {
        // Whole range sits in the future; nothing to show, so fall back.
        return build(DEFAULT_PRESET, presetStart(DEFAULT_PRESET, today), tomorrow, true);
      }
      return build("custom", start, new Date(lastDay.getTime() + DAY_MS), coerced);
    }
    // Incomplete or backwards custom dates: fall back rather than guess.
    return build(DEFAULT_PRESET, presetStart(DEFAULT_PRESET, today), tomorrow, true);
  }

  if (preset === "all") {
    const floor = opts.earliest ? startOfUtcDay(opts.earliest) : today;
    const capped = new Date(today.getTime() - (MAX_RANGE_DAYS - 1) * DAY_MS);
    let start = floor.getTime() < capped.getTime() ? capped : floor;
    // A floor in the future (clock skew, or a row stamped ahead) would give a
    // backwards range; pin it to today instead.
    if (start.getTime() > today.getTime()) start = today;
    return build("all", start, tomorrow, badPreset || start.getTime() !== floor.getTime());
  }

  return build(preset, presetStart(preset, today), tomorrow, badPreset);
}

function presetStart(preset: Exclude<MetricRangePreset, "all" | "custom">, today: Date): Date {
  return new Date(today.getTime() - (PRESET_DAYS[preset] - 1) * DAY_MS);
}

function build(
  preset: MetricRangePreset,
  from: Date,
  toExclusive: Date,
  coerced: boolean,
): MetricRange {
  const days = dayKeysBetween(from, toExclusive);
  const lastDay = new Date(toExclusive.getTime() - DAY_MS);
  return { preset, from, toExclusive, days, label: formatRangeLabel(from, lastDay), coerced };
}

/** The query string that reproduces this range, so links and the picker agree. */
export function metricRangeQuery(range: MetricRange): URLSearchParams {
  const params = new URLSearchParams();
  params.set("range", range.preset);
  if (range.preset === "custom") {
    params.set("from", dayKey(range.from));
    params.set("to", dayKey(new Date(range.toExclusive.getTime() - DAY_MS)));
  }
  return params;
}
