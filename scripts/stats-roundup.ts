/**
 * FishSpotter stats roundup — the "how are we doing?" one-pager.
 *
 * Read-only diagnostic: this script never writes. It pulls every headline
 * number the current schema can support and prints them as a single roundup,
 * so a funder update or a "what are the latest stats?" question is one command
 * rather than a hand-rolled query session.
 *
 * It covers the gap the admin dashboard leaves. `/admin/metrics` renders Reach /
 * Engagement / Learning from the consent-gated Event log; it says nothing about
 * the DISCOVERY pillar of the Pebbles economy (First Sighting), retention, or
 * the consensus machinery. Those are all derivable from `Answer` alone — the
 * award in src/app/api/answers/route.ts sets `ordinal` to the count of prior
 * answers on the clip, so arrival order (and therefore every First-Sighting
 * statistic) reconstructs exactly from `Answer.createdAt` ordering, with full
 * history back to launch and no consent gate.
 *
 * Run: npm run db:stats               (human roundup)
 *      npm run db:stats -- --json     (machine-readable dump)
 *      npm run db:stats -- --days 7   (change the recent-window, default 30)
 *
 * Requires .env.local (POSTGRES_PRISMA_URL). Aggregate only — no individual is
 * profiled; the one spotter-level cut (First-Sighting concentration) reports
 * shares, not identities.
 */

import { PrismaClient } from "@prisma/client";
import { PEBBLE_BASE_SIGHTING, PEBBLE_EARLY_SPOTTER, CONSENSUS_THRESHOLD_USERS, isContested } from "../src/lib/pebbles";
import { normalizeForMatch } from "../src/lib/normalize-answer";
import { computeStreakFromDates, toDateKey } from "../src/lib/streak";
import { CATALOGUE } from "../src/lib/idguide/catalogue";

const prisma = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const daysArg = args.indexOf("--days");
const WINDOW_DAYS = daysArg >= 0 ? Number(args[daysArg + 1]) || 30 : 30;

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const n = (v: number) => v.toLocaleString("en-GB");
const pct = (part: number, whole: number) =>
  whole === 0 ? "—" : `${Math.round((part / whole) * 1000) / 10}%`;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Humanise a duration given in milliseconds. */
function duration(ms: number | null): string {
  if (ms == null) return "—";
  const hours = ms / (60 * 60 * 1000);
  if (hours < 1) return `${Math.round(ms / 60000)} min`;
  if (hours < 48) return `${Math.round(hours * 10) / 10} h`;
  return `${Math.round((hours / 24) * 10) / 10} days`;
}

function heading(title: string) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
  console.log("─".repeat(Math.max(title.length, 32)));
}

function row(label: string, value: string, note?: string) {
  const padded = label.padEnd(34);
  console.log(`  ${padded}${value}${note ? `   \x1b[2m${note}\x1b[0m` : ""}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Fail with the fix rather than a Prisma stack trace — this script is run
  // ad-hoc by whoever wants the numbers, not from a configured CI job.
  if (!process.env.POSTGRES_PRISMA_URL) {
    console.error(
      "POSTGRES_PRISMA_URL is not set.\n" +
        "Run this against prod with your local credentials:\n\n" +
        "  npm run db:stats\n\n" +
        "(which is `tsx --env-file=.env.local scripts/stats-roundup.ts`).",
    );
    process.exitCode = 1;
    return;
  }

  const now = new Date();
  const since = new Date(now.getTime() - WINDOW_DAYS * DAY_MS);
  const since7 = new Date(now.getTime() - 7 * DAY_MS);

  // A single wide pull, then everything is computed in memory. The tables this
  // app has are small enough (tens of thousands of rows at most) that one pass
  // is cheaper and far simpler than a dozen round-trips, and it guarantees
  // every section sees a consistent snapshot.
  const [users, snippets, answers, events, unlocks, consensusEvents, vitals, purchases] =
    await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          createdAt: true,
          isGuest: true,
          emailVerified: true,
          onboardedAt: true,
          ageBracket: true,
          digestOptIn: true,
          leaderboardOptIn: true,
        },
      }),
      prisma.snippet.findMany({
        select: { id: true, site: true, excluded: true, createdAt: true, difficultyScore: true },
      }),
      prisma.answer.findMany({
        select: {
          id: true,
          userId: true,
          snippetId: true,
          chosenOption: true,
          isCorrect: true,
          points: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.event.findMany({
        select: {
          type: true,
          sessionId: true,
          userId: true,
          snippetId: true,
          value: true,
          referrer: true,
          utmSource: true,
          createdAt: true,
        },
      }),
      prisma.unlockedSpecies.findMany({
        select: { userId: true, scientificName: true, firstUnlockedAt: true },
      }),
      prisma.consensusEvent.findMany({
        select: { snippetId: true, normalisedName: true, achievedAt: true, creditedAnswerIds: true },
      }),
      prisma.vital.findMany({ select: { name: true, value: true, rating: true, createdAt: true } }),
      prisma.pebblePurchase.findMany({ select: { userId: true, itemId: true, consumedForDate: true } }),
    ]);

  const out: Record<string, unknown> = { generatedAt: now.toISOString(), windowDays: WINDOW_DAYS };

  // -------------------------------------------------------------------------
  // Reach
  // -------------------------------------------------------------------------
  const realUsers = users.filter((u) => !u.isGuest);
  const guests = users.filter((u) => u.isGuest);
  const newInWindow = users.filter((u) => u.createdAt >= since);
  const new7 = users.filter((u) => u.createdAt >= since7);
  const verified = realUsers.filter((u) => u.emailVerified != null);
  const onboarded = users.filter((u) => u.onboardedAt != null);
  const answeredEver = new Set(answers.map((a) => a.userId));
  const ageBrackets = users.reduce<Record<string, number>>((acc, u) => {
    const k = u.ageBracket ?? "not asked";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  out.reach = {
    totalUsers: users.length,
    registered: realUsers.length,
    guests: guests.length,
    newInWindow: newInWindow.length,
    new7d: new7.length,
    verified: verified.length,
    onboarded: onboarded.length,
    everSubmittedAnId: answeredEver.size,
    ageBrackets,
  };

  // -------------------------------------------------------------------------
  // Discovery — First Sighting (the Pebbles pillar the dashboard omits)
  // -------------------------------------------------------------------------
  // `answers` is ordered by createdAt ascending, so grouping preserves arrival
  // order per clip — the same ordering the award used at submit time.
  const answersBySnippet = new Map<string, typeof answers>();
  for (const a of answers) {
    const list = answersBySnippet.get(a.snippetId);
    if (list) list.push(a);
    else answersBySnippet.set(a.snippetId, [a]);
  }

  const liveSnippets = snippets.filter((s) => !s.excluded);
  const liveIds = new Set(liveSnippets.map((s) => s.id));
  const spottedLive = liveSnippets.filter((s) => answersBySnippet.has(s.id));
  const unspotted = liveSnippets.length - spottedLive.length;

  // Time from a clip going live to its first ID.
  const timesToFirst: number[] = [];
  const firstSpotterCounts = new Map<string, number>();
  const snippetById = new Map(snippets.map((s) => [s.id, s]));
  for (const [snippetId, list] of answersBySnippet) {
    if (!liveIds.has(snippetId)) continue;
    const snippet = snippetById.get(snippetId);
    const first = list[0];
    if (snippet) timesToFirst.push(first.createdAt.getTime() - snippet.createdAt.getTime());
    firstSpotterCounts.set(first.userId, (firstSpotterCounts.get(first.userId) ?? 0) + 1);
  }

  // How far into the [25, 12, 6] taper each spotted clip got.
  const slotFill = { one: 0, two: 0, threePlus: 0 };
  for (const [snippetId, list] of answersBySnippet) {
    if (!liveIds.has(snippetId)) continue;
    const distinct = new Set(list.map((a) => a.userId)).size;
    if (distinct === 1) slotFill.one++;
    else if (distinct === 2) slotFill.two++;
    else slotFill.threePlus++;
  }

  const concentration = [...firstSpotterCounts.values()].sort((a, b) => b - a);
  const top5FirstSpots = concentration.slice(0, 5).reduce((s, v) => s + v, 0);

  // Discovery Pebbles are reconstructable from arrival order; consensus Pebbles
  // are whatever the retro-credit added on top of that.
  let discoveryPebbles = 0;
  for (const [snippetId, list] of answersBySnippet) {
    if (!liveIds.has(snippetId)) continue;
    const seen = new Set<string>();
    for (const a of list) {
      if (seen.has(a.userId)) continue; // a re-guess never re-earns
      discoveryPebbles += PEBBLE_BASE_SIGHTING + (PEBBLE_EARLY_SPOTTER[seen.size] ?? 0);
      seen.add(a.userId);
    }
  }
  const totalPebbles = answers.reduce((s, a) => s + a.points, 0);

  out.discovery = {
    firstSightingsAwarded: spottedLive.length,
    unspottedClips: unspotted,
    liveClips: liveSnippets.length,
    medianTimeToFirstSpotMs: median(timesToFirst),
    distinctFirstSpotters: firstSpotterCounts.size,
    top5FirstSpotShare: spottedLive.length ? top5FirstSpots / spottedLive.length : null,
    slotFill,
    discoveryPebbles,
    totalPebbles,
  };

  // -------------------------------------------------------------------------
  // Engagement (consent-gated Event log)
  // -------------------------------------------------------------------------
  const sessionStarts = events.filter((e) => e.type === "session_start");
  const clipViews = events.filter((e) => e.type === "clip_view");
  const watchEvents = events.filter((e) => e.type === "clip_watch");
  const watchSeconds = watchEvents.reduce((s, e) => s + (e.value ?? 0), 0);
  const watchSecondsWindow = watchEvents
    .filter((e) => e.createdAt >= since)
    .reduce((s, e) => s + (e.value ?? 0), 0);

  const sessionsInWindow = sessionStarts.filter((e) => e.createdAt >= since);
  const activeUsersWindow = new Set(
    sessionsInWindow.filter((e) => e.userId != null).map((e) => e.userId as string),
  );

  // Clips seen per session, and the view -> ID conversion the funnel turns on.
  const clipsPerSession = new Map<string, number>();
  for (const e of clipViews) {
    clipsPerSession.set(e.sessionId, (clipsPerSession.get(e.sessionId) ?? 0) + 1);
  }
  const answersInWindow = answers.filter((a) => a.createdAt >= since);

  const sources = sessionsInWindow.reduce<Record<string, number>>((acc, e) => {
    const k = e.utmSource ?? e.referrer ?? "direct / unknown";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const topSources = Object.entries(sources)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  out.engagement = {
    eventLogRows: events.length,
    firstEventAt: events.length
      ? new Date(Math.min(...events.map((e) => e.createdAt.getTime()))).toISOString()
      : null,
    sessions: sessionStarts.length,
    sessionsInWindow: sessionsInWindow.length,
    activeUsersInWindow: activeUsersWindow.size,
    clipViews: clipViews.length,
    watchMinutesAllTime: Math.round(watchSeconds / 60),
    watchMinutesInWindow: Math.round(watchSecondsWindow / 60),
    medianClipsPerSession: median([...clipsPerSession.values()]),
    identifications: answers.length,
    identificationsInWindow: answersInWindow.length,
    viewToIdConversion: clipViews.length ? answers.length / clipViews.length : null,
    topSources,
  };

  // -------------------------------------------------------------------------
  // Retention
  // -------------------------------------------------------------------------
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
  const freezes = purchases.filter((p) => p.consumedForDate != null);

  out.retention = {
    spottersWithAnyId: datesByUser.size,
    spottersWithMoreThanOneDay: returners,
    returnRate: datesByUser.size ? returners / datesByUser.size : null,
    medianActiveDays: median(activeDayCounts),
    maxActiveDays: activeDayCounts.length ? Math.max(...activeDayCounts) : 0,
    liveStreaks: liveStreaks.length,
    longestLiveStreak: liveStreaks[0] ?? 0,
    tideFreezesConsumed: freezes.length,
  };

  // -------------------------------------------------------------------------
  // Learning
  // -------------------------------------------------------------------------
  const settled = answers.filter((a) => a.isCorrect != null);
  const matched = settled.filter((a) => a.isCorrect === true);
  const unlocksByUser = new Map<string, number>();
  for (const u of unlocks) unlocksByUser.set(u.userId, (unlocksByUser.get(u.userId) ?? 0) + 1);
  const distinctSpeciesUnlocked = new Set(unlocks.map((u) => u.scientificName));

  const answerFrequency = answers.reduce<Record<string, number>>((acc, a) => {
    const k = normalizeForMatch(a.chosenOption);
    if (k) acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const topAnswers = Object.entries(answerFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  out.learning = {
    speciesUnlocks: unlocks.length,
    distinctSpeciesUnlocked: distinctSpeciesUnlocked.size,
    catalogueSize: Object.keys(CATALOGUE).length,
    medianSpeciesPerSpotter: median([...unlocksByUser.values()]),
    settledIds: settled.length,
    consensusAccuracy: settled.length ? matched.length / settled.length : null,
    topAnswers,
  };

  // -------------------------------------------------------------------------
  // Community / consensus
  // -------------------------------------------------------------------------
  const eligible = [...answersBySnippet.entries()].filter(
    ([, list]) => new Set(list.map((a) => a.userId)).size >= CONSENSUS_THRESHOLD_USERS,
  );
  const timesToConsensus: number[] = [];
  for (const ce of consensusEvents) {
    const list = answersBySnippet.get(ce.snippetId);
    if (list?.length) timesToConsensus.push(ce.achievedAt.getTime() - list[0].createdAt.getTime());
  }
  let contested = 0;
  for (const [, list] of answersBySnippet) {
    const counts = new Map<string, number>();
    for (const a of list) {
      const k = normalizeForMatch(a.chosenOption);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const stats = [...counts.values()].sort((a, b) => b - a).map((count) => ({ count }));
    if (isContested(stats, new Set(list.map((a) => a.userId)).size)) contested++;
  }

  out.community = {
    clipsEligibleForConsensus: eligible.length,
    consensusReached: consensusEvents.length,
    answersRetroCredited: consensusEvents.reduce((s, c) => s + c.creditedAnswerIds.length, 0),
    medianTimeToConsensusMs: median(timesToConsensus),
    contestedClips: contested,
  };

  // -------------------------------------------------------------------------
  // Content & performance
  // -------------------------------------------------------------------------
  const bySite = liveSnippets.reduce<Record<string, number>>((acc, s) => {
    acc[s.site] = (acc[s.site] ?? 0) + 1;
    return acc;
  }, {});
  const vitalsByName = vitals.reduce<Record<string, { good: number; total: number }>>((acc, v) => {
    const e = (acc[v.name] ??= { good: 0, total: 0 });
    e.total++;
    if (v.rating === "good") e.good++;
    return acc;
  }, {});

  out.content = {
    liveClips: liveSnippets.length,
    excludedClips: snippets.length - liveSnippets.length,
    sites: bySite,
    vitals: vitalsByName,
  };

  if (asJson) {
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  // -------------------------------------------------------------------------
  // Human roundup
  // -------------------------------------------------------------------------
  console.log(`\n\x1b[1mFishSpotter — stats roundup\x1b[0m`);
  console.log(`\x1b[2m${now.toISOString().slice(0, 16).replace("T", " ")} UTC · recent window = ${WINDOW_DAYS} days\x1b[0m`);

  heading("Reach");
  row("Spotters (total)", n(users.length));
  row("— registered / guest", `${n(realUsers.length)} / ${n(guests.length)}`);
  row("Email verified", n(verified.length), pct(verified.length, realUsers.length) + " of registered");
  row("Completed onboarding", n(onboarded.length), pct(onboarded.length, users.length));
  row("Ever submitted an ID", n(answeredEver.size), pct(answeredEver.size, users.length) + " activation");
  row(`New signups (${WINDOW_DAYS}d / 7d)`, `${n(newInWindow.length)} / ${n(new7.length)}`);
  row("Age brackets", Object.entries(ageBrackets).map(([k, v]) => `${k}: ${v}`).join(", ") || "—");

  heading("Discovery — First Sighting");
  row("Clips with a first sighting", n(spottedLive.length), pct(spottedLive.length, liveSnippets.length) + " of live clips");
  row("Clips still unspotted", n(unspotted), "the backlog the +25 exists to clear");
  row("Median time to first spot", duration(median(timesToFirst)));
  row("Distinct first-spotters", n(firstSpotterCounts.size));
  row(
    "Top 5 spotters' share of firsts",
    spottedLive.length ? pct(top5FirstSpots, spottedLive.length) : "—",
    "concentration check",
  );
  row(
    "Taper fill (1 / 2 / 3+ spotters)",
    `${n(slotFill.one)} / ${n(slotFill.two)} / ${n(slotFill.threePlus)}`,
    "the [25, 12, 6] slots",
  );
  row("Pebbles from discovery", n(discoveryPebbles), pct(discoveryPebbles, totalPebbles) + " of all Pebbles");
  row("Pebbles awarded (total)", n(totalPebbles));

  heading(`Engagement (consent-gated · ${n(events.length)} event rows)`);
  if (events.length === 0) {
    console.log("  \x1b[2mNo events logged — either no analytics consent yet, or the\x1b[0m");
    console.log("  \x1b[2minstrumentation post-dates all current traffic.\x1b[0m");
  } else {
    row("Sessions (all / window)", `${n(sessionStarts.length)} / ${n(sessionsInWindow.length)}`);
    row("Active spotters (window)", n(activeUsersWindow.size));
    row("Clip views", n(clipViews.length));
    row("Median clips per session", median([...clipsPerSession.values()])?.toString() ?? "—");
    row("Watch time (all / window)", `${n(Math.round(watchSeconds / 60))} min / ${n(Math.round(watchSecondsWindow / 60))} min`);
    row("Identifications (all / window)", `${n(answers.length)} / ${n(answersInWindow.length)}`);
    row(
      "View → ID conversion",
      clipViews.length ? pct(answers.length, clipViews.length) : "—",
      "IDs per clip viewed",
    );
    if (topSources.length) {
      console.log("\n  \x1b[2mTop sources:\x1b[0m");
      for (const [label, count] of topSources) row(`  ${label}`, n(count));
    }
  }

  heading("Retention");
  row("Spotters with ≥1 ID", n(datesByUser.size));
  row("Came back on another day", n(returners), pct(returners, datesByUser.size) + " return rate");
  row("Median active days", median(activeDayCounts)?.toString() ?? "—");
  row("Most active days by one spotter", n(activeDayCounts.length ? Math.max(...activeDayCounts) : 0));
  row("Live streaks right now", n(liveStreaks.length), liveStreaks[0] ? `longest ${liveStreaks[0]} days` : "");
  row("Tide Freezes consumed", n(freezes.length));

  heading("Learning");
  row("Species unlocks", n(unlocks.length));
  row("Distinct species unlocked", `${n(distinctSpeciesUnlocked.size)} / ${n(Object.keys(CATALOGUE).length)}`, "of the catalogue");
  row("Median species per spotter", median([...unlocksByUser.values()])?.toString() ?? "—");
  row(
    "Consensus accuracy",
    settled.length ? pct(matched.length, settled.length) : "—",
    `${n(settled.length)} settled IDs`,
  );
  if (topAnswers.length) {
    console.log("\n  \x1b[2mMost-submitted IDs:\x1b[0m");
    for (const [label, count] of topAnswers) row(`  ${label}`, n(count));
  }

  heading("Community consensus");
  row("Clips with ≥3 spotters", n(eligible.length), "eligible for consensus");
  row("Consensus reached", n(consensusEvents.length), pct(consensusEvents.length, eligible.length) + " of eligible");
  row("Answers retro-credited", n(consensusEvents.reduce((s, c) => s + c.creditedAnswerIds.length, 0)));
  row("Median time to consensus", duration(median(timesToConsensus)));
  row("Contested clips", n(contested), "community genuinely split");

  heading("Content & performance");
  row("Live clips", n(liveSnippets.length), `${n(snippets.length - liveSnippets.length)} excluded`);
  row("Sites", Object.entries(bySite).map(([k, v]) => `${k} (${v})`).join(", ") || "—");
  row("Catalogue species", n(Object.keys(CATALOGUE).length));
  for (const [name, v] of Object.entries(vitalsByName)) {
    row(`${name} "good"`, pct(v.good, v.total), `${n(v.total)} samples`);
  }

  // The caveats that decide whether a number means what it looks like.
  heading("Read these with the numbers");
  console.log("  \x1b[2m· Event-derived rows (sessions, watch time, clip views) count ONLY\x1b[0m");
  console.log("  \x1b[2m  spotters who accepted analytics, and start at the 19 Jun 2026 ship.\x1b[0m");
  console.log("  \x1b[2m· Answer-derived rows (IDs, First Sightings, streaks) are complete.\x1b[0m");
  console.log("  \x1b[2m· isCorrect means 'matched the community leader', not a PEBL reference,\x1b[0m");
  console.log("  \x1b[2m  and stays null until the consensus cron settles a clip.\x1b[0m");
  console.log("  \x1b[2m· Answer.points was scaled x10 by the 18 Jun Pebbles migration, so any\x1b[0m");
  console.log("  \x1b[2m  cross-period Pebble comparison is apples-to-oranges.\x1b[0m");
  console.log();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
