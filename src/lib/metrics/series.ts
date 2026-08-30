/**
 * Per-day metric series for the /admin/metrics drill-down.
 *
 * `roundup.ts` answers "what are the headline numbers right now". This answers
 * "how did each of those numbers move, day by day", which is the thing a trend
 * chart and a funder's year-on-year question actually need.
 *
 * Pure on purpose: it takes narrow row projections and a list of UTC day keys,
 * and returns arrays aligned to those days. The database half lives in
 * `query.ts`; everything below is unit-tested against fixtures.
 *
 * Two distinctions the rest of the page leans on:
 *
 *   - A ratio day with no denominator is `null`, never `0`. A day on which
 *     nobody settled an ID has no accuracy, and drawing it as 0% would invent a
 *     collapse that never happened.
 *   - `totalIsSumOfDays` is false for distinct-count and running-total series.
 *     The daily bars of "active spotters" count a person once per day, so they
 *     add up to more than the range figure, and the chart says so rather than
 *     leaving an admin to find the discrepancy and mistrust the page.
 */

export interface UserRow {
  createdAt: Date;
}

export interface EventRow {
  createdAt: Date;
  type: string;
  value: number | null;
  userId: string | null;
}

export interface AnswerRow {
  createdAt: Date;
  isCorrect: boolean | null;
}

export interface UnlockRow {
  firstUnlockedAt: Date;
}

export interface SeriesInput {
  users: UserRow[];
  events: EventRow[];
  answers: AnswerRow[];
  unlocks: UnlockRow[];
  /** Spotters who signed up before the range started, the running total's base. */
  usersBefore: number;
}

/** Raw per-day counts, every array the same length as `days`. */
export interface DailyCounts {
  newSpotters: number[];
  /** Running total of all signups ever, not just those inside the range. */
  totalSpotters: number[];
  activeSpotters: number[];
  sessions: number[];
  watchSeconds: number[];
  clipViews: number[];
  identifications: number[];
  settledIds: number[];
  matchedIds: number[];
  speciesLearned: number[];
}

function dayKeyOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function zeros(n: number): number[] {
  return new Array<number>(n).fill(0);
}

/**
 * Bucket raw rows into UTC calendar days.
 *
 * Rows outside `days` are ignored rather than clamped onto the edges: the
 * loader queries the same window, so anything outside is a caller bug and
 * folding it into the first or last day would hide it behind a plausible spike.
 */
export function buildDailyCounts(days: string[], input: SeriesInput): DailyCounts {
  const index = new Map<string, number>();
  days.forEach((d, i) => index.set(d, i));
  const n = days.length;

  const counts: DailyCounts = {
    newSpotters: zeros(n),
    totalSpotters: zeros(n),
    activeSpotters: zeros(n),
    sessions: zeros(n),
    watchSeconds: zeros(n),
    clipViews: zeros(n),
    identifications: zeros(n),
    settledIds: zeros(n),
    matchedIds: zeros(n),
    speciesLearned: zeros(n),
  };

  for (const u of input.users) {
    const i = index.get(dayKeyOf(u.createdAt));
    if (i !== undefined) counts.newSpotters[i]++;
  }

  for (const a of input.answers) {
    const i = index.get(dayKeyOf(a.createdAt));
    if (i === undefined) continue;
    counts.identifications[i]++;
    // isCorrect stays null until the consensus cron settles the clip, so an
    // unsettled ID is not a wrong one and must not land in the denominator.
    if (a.isCorrect !== null) {
      counts.settledIds[i]++;
      if (a.isCorrect) counts.matchedIds[i]++;
    }
  }

  for (const u of input.unlocks) {
    const i = index.get(dayKeyOf(u.firstUnlockedAt));
    if (i !== undefined) counts.speciesLearned[i]++;
  }

  // One spotter with six sessions in a day is one active spotter, so the daily
  // figure is a distinct count, not an event count.
  const activePerDay: Array<Set<string>> = days.map(() => new Set<string>());
  for (const e of input.events) {
    const i = index.get(dayKeyOf(e.createdAt));
    if (i === undefined) continue;
    if (e.type === "session_start") {
      counts.sessions[i]++;
      if (e.userId) activePerDay[i].add(e.userId);
    } else if (e.type === "clip_view") {
      counts.clipViews[i]++;
    } else if (e.type === "clip_watch") {
      counts.watchSeconds[i] += e.value ?? 0;
    }
  }
  activePerDay.forEach((set, i) => {
    counts.activeSpotters[i] = set.size;
  });

  let running = input.usersBefore;
  for (let i = 0; i < n; i++) {
    running += counts.newSpotters[i];
    counts.totalSpotters[i] = running;
  }

  return counts;
}

/** Distinct spotters with a session anywhere in the range (not the daily sum). */
export function distinctActiveSpotters(days: string[], events: EventRow[]): number {
  const inRange = new Set(days);
  const seen = new Set<string>();
  for (const e of events) {
    if (e.type !== "session_start" || !e.userId) continue;
    if (inRange.has(dayKeyOf(e.createdAt))) seen.add(e.userId);
  }
  return seen.size;
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/**
 * Element-wise `numerator / denominator * scale`, null wherever the denominator
 * is zero. Used for accuracy and for average watch per session.
 */
export function ratioSeries(
  numerator: number[],
  denominator: number[],
  scale = 1,
): Array<number | null> {
  return numerator.map((n, i) => {
    const d = denominator[i];
    return d > 0 ? (n / d) * scale : null;
  });
}

/**
 * Trailing mean over `window` days, for the trend line drawn over a long
 * range's noisy daily bars. Leading days average over what exists rather than
 * returning null, so the line starts at the left edge instead of floating in.
 */
export function rollingAverage(values: number[], window: number): number[] {
  if (window <= 1) return [...values];
  const out: number[] = [];
  let acc = 0;
  for (let i = 0; i < values.length; i++) {
    acc += values[i];
    if (i >= window) acc -= values[i - window];
    out.push(acc / Math.min(i + 1, window));
  }
  return out;
}

export type MetricUnit = "count" | "minutes" | "percent";

/**
 * Bars for a per-day quantity, a line for a running total. A cumulative series
 * drawn as bars is a solid block that hides its own shape; drawn as a line it
 * shows the growth curve, which is the only thing it has to say.
 */
export type MetricShape = "bars" | "line";

export interface MetricSeries {
  key: string;
  label: string;
  /** Line under the headline number, saying what it counts. */
  sub: string;
  unit: MetricUnit;
  shape: MetricShape;
  /** One value per day, aligned to `days`. Null means "no data", not zero. */
  values: Array<number | null>;
  /** Headline for the whole range. Null when undefined (a ratio with no base). */
  total: number | null;
  /** False for distinct counts and running totals, where the bars over-add. */
  totalIsSumOfDays: boolean;
  /**
   * True when the metric comes from the Event log, which only covers spotters
   * who accepted analytics and only starts at the instrumentation ship.
   */
  eventDerived: boolean;
  /** Longer note shown inside the expanded chart. */
  note?: string;
}

export interface BuildSeriesOptions {
  /** Distinct spotters across the whole range (cannot be summed from days). */
  activeInRange: number;
}

/**
 * The chart-ready view of `DailyCounts`: labels, units and the right aggregate
 * per metric. Ordered by section (reach, engagement, learning) so the page can
 * slice it without re-stating the order.
 */
export function buildMetricSeries(
  counts: DailyCounts,
  opts: BuildSeriesOptions,
): MetricSeries[] {
  const totalWatchSeconds = sum(counts.watchSeconds);
  const totalSessions = sum(counts.sessions);
  const settled = sum(counts.settledIds);
  const matched = sum(counts.matchedIds);
  const lastTotal = counts.totalSpotters.at(-1) ?? 0;

  return [
    {
      key: "totalSpotters",
      label: "Spotters",
      sub: "total signups, all time",
      unit: "count",
      shape: "line",
      values: counts.totalSpotters,
      total: lastTotal,
      totalIsSumOfDays: false,
      eventDerived: false,
      note: "Running total of every signup to date, so the line starts at the count the app already had on the first day of this range.",
    },
    {
      key: "newSpotters",
      label: "New spotters",
      sub: "signed up in this range",
      unit: "count",
      shape: "bars",
      values: counts.newSpotters,
      total: sum(counts.newSpotters),
      totalIsSumOfDays: true,
      eventDerived: false,
    },
    {
      key: "activeSpotters",
      label: "Active spotters",
      sub: "with a logged session",
      unit: "count",
      shape: "bars",
      values: counts.activeSpotters,
      total: opts.activeInRange,
      totalIsSumOfDays: false,
      eventDerived: true,
      note: "Each bar counts a spotter once for that day. Someone who came back on five days appears in five bars but once in the range figure, so the bars add up to more than the headline.",
    },
    {
      key: "sessions",
      label: "Sessions",
      sub: "tab sessions",
      unit: "count",
      shape: "bars",
      values: counts.sessions,
      total: totalSessions,
      totalIsSumOfDays: true,
      eventDerived: true,
    },
    {
      key: "watchMinutes",
      label: "Watch time",
      sub: "active viewing",
      unit: "minutes",
      shape: "bars",
      values: counts.watchSeconds.map((s) => s / 60),
      total: totalWatchSeconds / 60,
      totalIsSumOfDays: true,
      eventDerived: true,
      note: "On-screen, tab-visible time only, banked in short segments while a clip is the active card.",
    },
    {
      key: "clipViews",
      label: "Clips watched",
      sub: "clip views logged",
      unit: "count",
      shape: "bars",
      values: counts.clipViews,
      total: sum(counts.clipViews),
      totalIsSumOfDays: true,
      eventDerived: true,
    },
    {
      key: "identifications",
      label: "Identifications",
      sub: "IDs submitted",
      unit: "count",
      shape: "bars",
      values: counts.identifications,
      total: sum(counts.identifications),
      totalIsSumOfDays: true,
      eventDerived: false,
    },
    {
      key: "watchPerSession",
      label: "Per session",
      sub: "avg viewing per session",
      unit: "minutes",
      shape: "bars",
      values: ratioSeries(counts.watchSeconds, counts.sessions, 1 / 60),
      total: totalSessions > 0 ? totalWatchSeconds / 60 / totalSessions : null,
      totalIsSumOfDays: false,
      eventDerived: true,
      note: "Watch minutes divided by sessions. Days with no session have no average and are left blank rather than drawn as zero.",
    },
    {
      key: "speciesLearned",
      label: "Species learned",
      sub: "collection unlocks",
      unit: "count",
      shape: "bars",
      values: counts.speciesLearned,
      total: sum(counts.speciesLearned),
      totalIsSumOfDays: true,
      eventDerived: false,
    },
    {
      key: "accuracy",
      label: "Consensus accuracy",
      sub: "IDs matching the community",
      unit: "percent",
      shape: "bars",
      values: ratioSeries(counts.matchedIds, counts.settledIds, 100),
      total: settled > 0 ? (matched / settled) * 100 : null,
      totalIsSumOfDays: false,
      eventDerived: false,
      note: "Of the IDs submitted on a day, the share the consensus cron has since settled as matching the community leader. IDs on clips nobody has settled yet count in neither half, so a recent day can be blank and fill in later.",
    },
  ];
}

/** The card grid is drawn in three sections; this is the one place they are named. */
export const METRIC_SECTIONS: ReadonlyArray<{ title: string; keys: string[] }> = [
  { title: "Reach", keys: ["totalSpotters", "newSpotters", "activeSpotters", "sessions"] },
  {
    title: "Engagement",
    keys: ["watchMinutes", "clipViews", "identifications", "watchPerSession"],
  },
  { title: "Learning", keys: ["speciesLearned", "accuracy"] },
];
