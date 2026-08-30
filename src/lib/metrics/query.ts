/**
 * The database half of the /admin/metrics drill-down.
 *
 * `loadMetricsView` is the single entry point: it resolves the range from the
 * URL, pulls the rows for exactly that window, and hands them to the pure
 * builders in `series.ts`. The page and the CSV export both call it, so a
 * number on screen and the same number in a funder's spreadsheet come from one
 * query and one definition.
 *
 * Row volume: this reads raw rows rather than a SQL group-by, because Prisma
 * cannot group by a date truncation without dropping to raw SQL, and the daily
 * distinct-spotter count needs the userId column anyway. At this app's volume
 * (low thousands of events a month) that is a few hundred KB even for the
 * longest range, and `MAX_RANGE_DAYS` in `range.ts` is the ceiling that keeps
 * it so.
 *
 * The query window is the range PLUS the equal-length window before it, in one
 * pass, so every card can show a change against the previous period without a
 * second round of queries. `buildDailyCounts` ignores rows outside the day list
 * it is given, so the same row arrays bucket cleanly into either half.
 */

import type { PrismaClient } from "@prisma/client";
import {
  buildDailyCounts,
  buildMetricSeries,
  distinctActiveSpotters,
  sum,
  type DailyCounts,
  type MetricSeries,
} from "@/lib/metrics/series";
import { dayKeysBetween, parseMetricRange, type MetricRange } from "@/lib/metrics/range";

export interface TopSource {
  label: string;
  count: number;
}

export interface MetricsView {
  range: MetricRange;
  counts: DailyCounts;
  series: MetricSeries[];
  /**
   * Headline for each metric over the equal-length window immediately before
   * the range, keyed by metric key. Null for the "all" preset, where there is
   * no earlier period to compare against.
   */
  previousTotals: Record<string, number | null> | null;
  /** Human label for that comparison window, e.g. "2 - 31 Jul 2026". */
  previousLabel: string | null;
  topSources: TopSource[];
  /**
   * When the Event log actually starts. Days before it have no analytics at
   * all, which is not the same as nobody using the site, so the chart shades
   * them instead of drawing a run of honest-looking zeroes.
   */
  firstEventAt: Date | null;
  /** Oldest row of any kind, the floor the "all" preset resolves to. */
  earliestAt: Date | null;
}

type SearchParams = Record<string, string | string[] | undefined>;

export async function loadMetricsView(
  prisma: PrismaClient,
  searchParams: SearchParams,
  opts: { now?: Date } = {},
): Promise<MetricsView> {
  // The "all" preset needs a floor before the range exists, so the two oldest
  // timestamps are fetched first. Both are indexed single-row lookups.
  const [firstUser, firstEvent] = await Promise.all([
    prisma.user.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.event.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);
  const earliestAt =
    firstUser && firstEvent
      ? new Date(Math.min(firstUser.createdAt.getTime(), firstEvent.createdAt.getTime()))
      : (firstUser?.createdAt ?? firstEvent?.createdAt ?? null);

  const range = parseMetricRange(searchParams, { now: opts.now, earliest: earliestAt });

  // "All time" has nothing before it, so it skips the comparison window rather
  // than reading an empty one and reporting a meaningless +100%.
  const wantsPrevious = range.preset !== "all";
  const spanMs = range.toExclusive.getTime() - range.from.getTime();
  const previousFrom = wantsPrevious ? new Date(range.from.getTime() - spanMs) : range.from;
  const previousDays = wantsPrevious ? dayKeysBetween(previousFrom, range.from) : [];
  const window = { gte: previousFrom, lt: range.toExclusive };

  const [users, usersBeforeWindow, events, answers, unlocks, sourceRows] = await Promise.all([
    prisma.user.findMany({ where: { createdAt: window }, select: { createdAt: true } }),
    prisma.user.count({ where: { createdAt: { lt: previousFrom } } }),
    prisma.event.findMany({
      where: { createdAt: window },
      select: { createdAt: true, type: true, value: true, userId: true },
    }),
    prisma.answer.findMany({
      where: { createdAt: window },
      select: { createdAt: true, isCorrect: true },
    }),
    prisma.unlockedSpecies.findMany({
      where: { firstUnlockedAt: window },
      select: { firstUnlockedAt: true },
    }),
    prisma.event.groupBy({
      by: ["utmSource", "referrer"],
      where: {
        type: "session_start",
        createdAt: { gte: range.from, lt: range.toExclusive },
      },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
  ]);

  const rows = { users, events, answers, unlocks };

  // The previous window's signups are what stand between "everyone before the
  // whole query window" and "everyone before the range", so the running total
  // starts from the right base without a second count query.
  let previousTotals: Record<string, number | null> | null = null;
  let usersBefore = usersBeforeWindow;
  if (wantsPrevious) {
    const previousCounts = buildDailyCounts(previousDays, {
      ...rows,
      usersBefore: usersBeforeWindow,
    });
    const previousSeries = buildMetricSeries(previousCounts, {
      activeInRange: distinctActiveSpotters(previousDays, events),
    });
    previousTotals = Object.fromEntries(previousSeries.map((s) => [s.key, s.total]));
    usersBefore = usersBeforeWindow + sum(previousCounts.newSpotters);
  }

  const counts = buildDailyCounts(range.days, { ...rows, usersBefore });
  const series = buildMetricSeries(counts, {
    activeInRange: distinctActiveSpotters(range.days, events),
  });

  const topSources = sourceRows
    .map((r) => ({ label: r.utmSource ?? r.referrer ?? "direct / unknown", count: r._count._all }))
    .filter((r) => r.count > 0);

  return {
    range,
    counts,
    series,
    previousTotals,
    previousLabel: wantsPrevious ? previousRangeLabel(previousDays) : null,
    topSources,
    firstEventAt: firstEvent?.createdAt ?? null,
    earliestAt,
  };
}

function previousRangeLabel(days: string[]): string | null {
  if (days.length === 0) return null;
  return `${days[0]} to ${days[days.length - 1]}`;
}

/**
 * The per-day CSV, built from the same `DailyCounts` the screen draws, so an
 * exported spreadsheet and the chart above it can never tell different stories.
 */
export function metricsCsv(range: MetricRange, counts: DailyCounts): string {
  const header = [
    "date",
    "new_spotters",
    "total_spotters",
    "active_spotters",
    "sessions",
    "watch_minutes",
    "clips_watched",
    "identifications",
    "settled_ids",
    "matched_ids",
    "species_learned",
  ].join(",");

  const lines = range.days.map((day, i) =>
    [
      day,
      counts.newSpotters[i],
      counts.totalSpotters[i],
      counts.activeSpotters[i],
      counts.sessions[i],
      Math.round(counts.watchSeconds[i] / 60),
      counts.clipViews[i],
      counts.identifications[i],
      counts.settledIds[i],
      counts.matchedIds[i],
      counts.speciesLearned[i],
    ].join(","),
  );

  return [header, ...lines].join("\n") + "\n";
}
