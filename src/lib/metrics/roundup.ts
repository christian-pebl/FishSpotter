/**
 * FishSpotter stats roundup — shared aggregation, single source of truth.
 *
 * `computeRoundup()` is the one place that knows how to turn the raw tables
 * into the headline numbers. It is called by three consumers that must never
 * drift apart: `scripts/stats-roundup.ts` (CLI), `GET /api/metrics/summary`
 * (Phase 2, token-gated remote access), and `/admin/metrics` (browser). See
 * `implementation/2026-08-01/metrics-access-plan.md` for why this exists.
 *
 * SQL-side vs in-memory split (deliberate, not incidental — this runs inside
 * a 60s serverless function budget as the tables grow):
 *   - Anything that's just a total, a sum, or a single-column group-by goes
 *     through Prisma's `count` / `aggregate` / `groupBy` so Postgres does the
 *     work and only the small result crosses the wire.
 *   - The Discovery (First Sighting) and Community (contested-clip) numbers
 *     need arrival ORDER and per-snippet DISTINCT-spotter breakdowns, neither
 *     of which a single Prisma `groupBy` can express without raw SQL. Those
 *     stay in-memory, but over one narrow `Answer` projection
 *     (`snippetId, userId, chosenOption, createdAt` — no `id`, `points`, or
 *     `isCorrect`, all of which now come from SQL-side aggregates instead).
 *
 * First-Sighting arrival order needs no dedicated instrumentation: the award
 * in `src/app/api/answers/route.ts` sets `ordinal` to the count of prior
 * answers on the clip, so re-sorting `Answer` by `createdAt` reconstructs the
 * exact order the award saw at submit time, with full history and no consent
 * gate (unlike the `Event` log, which only covers spotters who accepted
 * analytics and starts at the 19 Jun 2026 instrumentation ship).
 */

import type { PrismaClient } from "@prisma/client";
import {
  PEBBLE_BASE_SIGHTING,
  PEBBLE_EARLY_SPOTTER,
  CONSENSUS_THRESHOLD_USERS,
  isContested,
} from "@/lib/pebbles";
import { normalizeForMatch } from "@/lib/normalize-answer";
import { computeStreakFromDates, toDateKey } from "@/lib/streak";
import { CATALOGUE } from "@/lib/idguide/catalogue";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Caveats that decide whether a figure means what it looks like. Shipped
 * alongside the numbers (not just printed by the CLI) so a consumer — human
 * or funder report — can't quote a consent-gated or pre-migration number as
 * if it were complete.
 */
export const ROUNDUP_CAVEATS: readonly string[] = [
  "Event-derived rows (sessions, watch time, clip views) count only spotters who accepted analytics, and start at the 19 Jun 2026 instrumentation ship.",
  "Answer-derived rows (IDs, First Sightings, streaks) are complete back to launch.",
  "isCorrect means 'matched the community leader', not a PEBL reference, and stays null until the consensus cron settles a clip.",
  "Answer.points was scaled x10 by the 18 Jun 2026 Pebbles migration, so any cross-period Pebble comparison is apples-to-oranges.",
];

export interface Roundup {
  generatedAt: string;
  windowDays: number;
  reach: {
    totalUsers: number;
    registered: number;
    guests: number;
    newInWindow: number;
    new7d: number;
    verified: number;
    onboarded: number;
    everSubmittedAnId: number;
    ageBrackets: Record<string, number>;
  };
  discovery: {
    firstSightingsAwarded: number;
    unspottedClips: number;
    liveClips: number;
    medianTimeToFirstSpotMs: number | null;
    distinctFirstSpotters: number;
    top5FirstSpotShare: number | null;
    slotFill: { one: number; two: number; threePlus: number };
    discoveryPebbles: number;
    totalPebbles: number;
  };
  engagement: {
    eventLogRows: number;
    firstEventAt: string | null;
    sessions: number;
    sessionsInWindow: number;
    activeUsersInWindow: number;
    clipViews: number;
    watchMinutesAllTime: number;
    watchMinutesInWindow: number;
    medianClipsPerSession: number | null;
    identifications: number;
    identificationsInWindow: number;
    viewToIdConversion: number | null;
    topSources: Array<[string, number]>;
  };
  retention: {
    spottersWithAnyId: number;
    spottersWithMoreThanOneDay: number;
    returnRate: number | null;
    medianActiveDays: number | null;
    maxActiveDays: number;
    liveStreaks: number;
    longestLiveStreak: number;
    tideFreezesConsumed: number;
  };
  learning: {
    speciesUnlocks: number;
    distinctSpeciesUnlocked: number;
    catalogueSize: number;
    medianSpeciesPerSpotter: number | null;
    settledIds: number;
    consensusAccuracy: number | null;
    topAnswers: Array<[string, number]>;
  };
  community: {
    clipsEligibleForConsensus: number;
    consensusReached: number;
    answersRetroCredited: number;
    medianTimeToConsensusMs: number | null;
    contestedClips: number;
  };
  content: {
    liveClips: number;
    excludedClips: number;
    sites: Record<string, number>;
    vitals: Record<string, { good: number; total: number }>;
  };
  caveats: readonly string[];
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export interface ComputeRoundupOptions {
  windowDays?: number;
  /** Override "now" for deterministic tests. Defaults to `new Date()`. */
  now?: Date;
}

export async function computeRoundup(
  prisma: PrismaClient,
  opts: ComputeRoundupOptions = {},
): Promise<Roundup> {
  const now = opts.now ?? new Date();
  const windowDays = opts.windowDays ?? 30;
  const since = new Date(now.getTime() - windowDays * DAY_MS);
  const since7 = new Date(now.getTime() - 7 * DAY_MS);

  // ---------------------------------------------------------------------
  // SQL-side: totals, sums, single-column group-bys. Postgres does the
  // work; only small aggregates cross the wire.
  // ---------------------------------------------------------------------
  const [
    totalUsers,
    registered,
    guests,
    newInWindow,
    new7d,
    verified,
    onboarded,
    ageBracketGroups,
    answeredEverRows,
    liveClips,
    excludedClips,
    bySiteGroups,
    speciesUnlocks,
    distinctSpeciesGroups,
    unlocksByUserGroups,
    settledIds,
    matched,
    vitalsGroups,
    sessions,
    sessionsInWindow,
    clipViewsCount,
    identifications,
    identificationsInWindow,
    watchAgg,
    watchAggWindow,
    eventLogRows,
    firstEventAgg,
    activeUsersWindowRows,
    clipViewSessionGroups,
    sourceRows,
    totalPebblesAgg,
    freezesCount,
    consensusEvents,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isGuest: false } }),
    prisma.user.count({ where: { isGuest: true } }),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.user.count({ where: { createdAt: { gte: since7 } } }),
    prisma.user.count({ where: { isGuest: false, emailVerified: { not: null } } }),
    prisma.user.count({ where: { onboardedAt: { not: null } } }),
    prisma.user.groupBy({ by: ["ageBracket"], _count: { _all: true } }),
    prisma.answer.findMany({ distinct: ["userId"], select: { userId: true } }),
    prisma.snippet.count({ where: { excluded: false } }),
    prisma.snippet.count({ where: { excluded: true } }),
    prisma.snippet.groupBy({ by: ["site"], where: { excluded: false }, _count: { _all: true } }),
    prisma.unlockedSpecies.count(),
    prisma.unlockedSpecies.groupBy({ by: ["scientificName"] }),
    prisma.unlockedSpecies.groupBy({ by: ["userId"], _count: { _all: true } }),
    prisma.answer.count({ where: { isCorrect: { not: null } } }),
    prisma.answer.count({ where: { isCorrect: true } }),
    prisma.vital.groupBy({ by: ["name", "rating"], _count: { _all: true } }),
    prisma.event.count({ where: { type: "session_start" } }),
    prisma.event.count({ where: { type: "session_start", createdAt: { gte: since } } }),
    prisma.event.count({ where: { type: "clip_view" } }),
    prisma.answer.count(),
    prisma.answer.count({ where: { createdAt: { gte: since } } }),
    prisma.event.aggregate({ _sum: { value: true }, where: { type: "clip_watch" } }),
    prisma.event.aggregate({
      _sum: { value: true },
      where: { type: "clip_watch", createdAt: { gte: since } },
    }),
    prisma.event.count(),
    prisma.event.aggregate({ _min: { createdAt: true } }),
    prisma.event.findMany({
      distinct: ["userId"],
      where: { type: "session_start", createdAt: { gte: since }, userId: { not: null } },
      select: { userId: true },
    }),
    prisma.event.groupBy({ by: ["sessionId"], where: { type: "clip_view" }, _count: { _all: true } }),
    prisma.event.findMany({
      where: { type: "session_start", createdAt: { gte: since } },
      select: { utmSource: true, referrer: true },
    }),
    prisma.answer.aggregate({ _sum: { points: true } }),
    prisma.pebblePurchase.count({ where: { consumedForDate: { not: null } } }),
    prisma.consensusEvent.findMany({
      select: { snippetId: true, achievedAt: true, creditedAnswerIds: true },
    }),
  ]);

  // ---------------------------------------------------------------------
  // In-memory: arrival-order and per-snippet distinct-spotter maths that a
  // single Prisma groupBy can't express. One narrow Answer projection feeds
  // Discovery, Community and the Learning "top answers" list; a narrow
  // Snippet projection supplies each clip's createdAt + excluded flag.
  // ---------------------------------------------------------------------
  const [answers, snippets] = await Promise.all([
    prisma.answer.findMany({
      select: { snippetId: true, userId: true, chosenOption: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.snippet.findMany({ select: { id: true, createdAt: true, excluded: true } }),
  ]);

  const answersBySnippet = new Map<string, typeof answers>();
  for (const a of answers) {
    const list = answersBySnippet.get(a.snippetId);
    if (list) list.push(a);
    else answersBySnippet.set(a.snippetId, [a]);
  }

  const liveIds = new Set(snippets.filter((s) => !s.excluded).map((s) => s.id));
  const snippetById = new Map(snippets.map((s) => [s.id, s]));
  const spottedLiveCount = [...answersBySnippet.keys()].filter((id) => liveIds.has(id)).length;
  const unspotted = liveIds.size - spottedLiveCount;

  const timesToFirst: number[] = [];
  const firstSpotterCounts = new Map<string, number>();
  const slotFill = { one: 0, two: 0, threePlus: 0 };
  let discoveryPebbles = 0;

  for (const [snippetId, list] of answersBySnippet) {
    if (!liveIds.has(snippetId)) continue;
    const snippet = snippetById.get(snippetId);
    const first = list[0];
    if (snippet) timesToFirst.push(first.createdAt.getTime() - snippet.createdAt.getTime());
    firstSpotterCounts.set(first.userId, (firstSpotterCounts.get(first.userId) ?? 0) + 1);

    const seen = new Set<string>();
    for (const a of list) {
      if (seen.has(a.userId)) continue; // a re-guess never re-earns or re-counts a slot
      discoveryPebbles += PEBBLE_BASE_SIGHTING + (PEBBLE_EARLY_SPOTTER[seen.size] ?? 0);
      seen.add(a.userId);
    }
    if (seen.size === 1) slotFill.one++;
    else if (seen.size === 2) slotFill.two++;
    else slotFill.threePlus++;
  }

  const concentration = [...firstSpotterCounts.values()].sort((a, b) => b - a);
  const top5FirstSpots = concentration.slice(0, 5).reduce((s, v) => s + v, 0);

  const datesByUser = new Map<string, Set<string>>();
  for (const a of answers) {
    let set = datesByUser.get(a.userId);
    if (!set) datesByUser.set(a.userId, (set = new Set()));
    set.add(toDateKey(a.createdAt));
  }
  const activeDayCounts = [...datesByUser.values()].map((s) => s.size);
  const returners = activeDayCounts.filter((c) => c > 1).length;
  const liveStreaks = [...datesByUser.values()]
    .map((s) => computeStreakFromDates(s, now).currentStreak)
    .filter((v) => v > 0)
    .sort((a, b) => b - a);

  const answerFrequency = new Map<string, number>();
  for (const a of answers) {
    const k = normalizeForMatch(a.chosenOption);
    if (k) answerFrequency.set(k, (answerFrequency.get(k) ?? 0) + 1);
  }
  const topAnswers = [...answerFrequency.entries()].sort(([, a], [, b]) => b - a).slice(0, 8);

  const eligible = [...answersBySnippet.values()].filter(
    (list) => new Set(list.map((a) => a.userId)).size >= CONSENSUS_THRESHOLD_USERS,
  );
  const timesToConsensus: number[] = [];
  for (const ce of consensusEvents) {
    const list = answersBySnippet.get(ce.snippetId);
    if (list?.length) timesToConsensus.push(ce.achievedAt.getTime() - list[0].createdAt.getTime());
  }
  let contested = 0;
  for (const list of answersBySnippet.values()) {
    const counts = new Map<string, number>();
    for (const a of list) {
      const k = normalizeForMatch(a.chosenOption);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const stats = [...counts.values()].sort((a, b) => b - a).map((count) => ({ count }));
    if (isContested(stats, new Set(list.map((a) => a.userId)).size)) contested++;
  }

  const clipViewCounts = clipViewSessionGroups.map((g) => g._count._all);
  const sources = new Map<string, number>();
  for (const r of sourceRows) {
    const k = r.utmSource ?? r.referrer ?? "direct / unknown";
    sources.set(k, (sources.get(k) ?? 0) + 1);
  }
  const topSources = [...sources.entries()].sort(([, a], [, b]) => b - a).slice(0, 8);

  const ageBrackets: Record<string, number> = {};
  for (const g of ageBracketGroups) ageBrackets[g.ageBracket ?? "not asked"] = g._count._all;

  const bySite: Record<string, number> = {};
  for (const g of bySiteGroups) bySite[g.site] = g._count._all;

  const vitalsByName: Record<string, { good: number; total: number }> = {};
  for (const g of vitalsGroups) {
    const e = (vitalsByName[g.name] ??= { good: 0, total: 0 });
    e.total += g._count._all;
    if (g.rating === "good") e.good += g._count._all;
  }

  const totalPebbles = totalPebblesAgg._sum.points ?? 0;
  const watchSeconds = watchAgg._sum.value ?? 0;
  const watchSecondsWindow = watchAggWindow._sum.value ?? 0;
  const answersRetroCredited = consensusEvents.reduce((s, c) => s + c.creditedAnswerIds.length, 0);

  return {
    generatedAt: now.toISOString(),
    windowDays,
    reach: {
      totalUsers,
      registered,
      guests,
      newInWindow,
      new7d,
      verified,
      onboarded,
      everSubmittedAnId: answeredEverRows.length,
      ageBrackets,
    },
    discovery: {
      firstSightingsAwarded: spottedLiveCount,
      unspottedClips: unspotted,
      liveClips: liveIds.size,
      medianTimeToFirstSpotMs: median(timesToFirst),
      distinctFirstSpotters: firstSpotterCounts.size,
      top5FirstSpotShare: spottedLiveCount ? top5FirstSpots / spottedLiveCount : null,
      slotFill,
      discoveryPebbles,
      totalPebbles,
    },
    engagement: {
      eventLogRows,
      firstEventAt: firstEventAgg._min.createdAt?.toISOString() ?? null,
      sessions,
      sessionsInWindow,
      activeUsersInWindow: activeUsersWindowRows.length,
      clipViews: clipViewsCount,
      watchMinutesAllTime: Math.round(watchSeconds / 60),
      watchMinutesInWindow: Math.round(watchSecondsWindow / 60),
      medianClipsPerSession: median(clipViewCounts),
      identifications,
      identificationsInWindow,
      viewToIdConversion: clipViewsCount ? identifications / clipViewsCount : null,
      topSources,
    },
    retention: {
      spottersWithAnyId: datesByUser.size,
      spottersWithMoreThanOneDay: returners,
      returnRate: datesByUser.size ? returners / datesByUser.size : null,
      medianActiveDays: median(activeDayCounts),
      maxActiveDays: activeDayCounts.length ? Math.max(...activeDayCounts) : 0,
      liveStreaks: liveStreaks.length,
      longestLiveStreak: liveStreaks[0] ?? 0,
      tideFreezesConsumed: freezesCount,
    },
    learning: {
      speciesUnlocks,
      distinctSpeciesUnlocked: distinctSpeciesGroups.length,
      catalogueSize: Object.keys(CATALOGUE).length,
      medianSpeciesPerSpotter: median(unlocksByUserGroups.map((g) => g._count._all)),
      settledIds,
      consensusAccuracy: settledIds ? matched / settledIds : null,
      topAnswers,
    },
    community: {
      clipsEligibleForConsensus: eligible.length,
      consensusReached: consensusEvents.length,
      answersRetroCredited,
      medianTimeToConsensusMs: median(timesToConsensus),
      contestedClips: contested,
    },
    content: {
      liveClips,
      excludedClips,
      sites: bySite,
      vitals: vitalsByName,
    },
    caveats: ROUNDUP_CAVEATS,
  };
}
