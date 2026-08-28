/**
 * FishSpotter stats roundup, the "how are we doing?" one-pager.
 *
 * Read-only diagnostic: this script never writes. It's a thin CLI formatter
 * over `computeRoundup()` (src/lib/metrics/roundup.ts), which is the single
 * source of truth shared with `GET /api/metrics/summary` and `/admin/metrics`
 *, see `implementation/2026-08-01/metrics-access-plan.md` for why the
 * aggregation itself doesn't live here.
 *
 * Run: npm run db:stats               (human roundup)
 *      npm run db:stats -- --json     (machine-readable dump)
 *      npm run db:stats -- --days 7   (change the recent-window, default 30)
 *
 * Requires .env.local (POSTGRES_PRISMA_URL).
 */

import { PrismaClient } from "@prisma/client";
import { computeRoundup, type Roundup } from "../src/lib/metrics/roundup";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const daysArg = args.indexOf("--days");
const windowDays = daysArg >= 0 ? Number(args[daysArg + 1]) || 30 : 30;

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const n = (v: number) => v.toLocaleString("en-GB");
const pct = (part: number, whole: number) =>
  whole === 0 ? "-" : `${Math.round((part / whole) * 1000) / 10}%`;
const pctOrNull = (ratio: number | null) => (ratio == null ? "-" : `${Math.round(ratio * 1000) / 10}%`);

/** Humanise a duration given in milliseconds. */
function duration(ms: number | null): string {
  if (ms == null) return "-";
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

function printRoundup(r: Roundup) {
  console.log(`\n\x1b[1mFishSpotter, stats roundup\x1b[0m`);
  console.log(
    `\x1b[2m${r.generatedAt.slice(0, 16).replace("T", " ")} UTC · recent window = ${r.windowDays} days\x1b[0m`,
  );

  heading("Reach");
  row("Spotters (total)", n(r.reach.totalUsers));
  row("- registered / guest", `${n(r.reach.registered)} / ${n(r.reach.guests)}`);
  row("Email verified", n(r.reach.verified), pct(r.reach.verified, r.reach.registered) + " of registered");
  row("Completed onboarding", n(r.reach.onboarded), pct(r.reach.onboarded, r.reach.totalUsers));
  row(
    "Ever submitted an ID",
    n(r.reach.everSubmittedAnId),
    pct(r.reach.everSubmittedAnId, r.reach.totalUsers) + " activation",
  );
  row(`New signups (${r.windowDays}d / 7d)`, `${n(r.reach.newInWindow)} / ${n(r.reach.new7d)}`);
  row(
    "Age brackets",
    Object.entries(r.reach.ageBrackets)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ") || "-",
  );

  heading("Discovery, First Sighting");
  row(
    "Clips with a first sighting",
    n(r.discovery.firstSightingsAwarded),
    pct(r.discovery.firstSightingsAwarded, r.discovery.liveClips) + " of live clips",
  );
  row("Clips still unspotted", n(r.discovery.unspottedClips), "the backlog the +25 exists to clear");
  row("Median time to first spot", duration(r.discovery.medianTimeToFirstSpotMs));
  row("Distinct first-spotters", n(r.discovery.distinctFirstSpotters));
  row(
    "Top 5 spotters' share of firsts",
    pctOrNull(r.discovery.top5FirstSpotShare),
    "concentration check",
  );
  row(
    "Taper fill (1 / 2 / 3+ spotters)",
    `${n(r.discovery.slotFill.one)} / ${n(r.discovery.slotFill.two)} / ${n(r.discovery.slotFill.threePlus)}`,
    "the [25, 12, 6] slots",
  );
  row(
    "Pebbles from discovery",
    n(r.discovery.discoveryPebbles),
    pct(r.discovery.discoveryPebbles, r.discovery.totalPebbles) + " of all Pebbles",
  );
  row("Pebbles awarded (total)", n(r.discovery.totalPebbles));

  heading(`Engagement (consent-gated · ${n(r.engagement.eventLogRows)} event rows)`);
  if (r.engagement.eventLogRows === 0) {
    console.log("  \x1b[2mNo events logged, either no analytics consent yet, or the\x1b[0m");
    console.log("  \x1b[2minstrumentation post-dates all current traffic.\x1b[0m");
  } else {
    row("Sessions (all / window)", `${n(r.engagement.sessions)} / ${n(r.engagement.sessionsInWindow)}`);
    row("Active spotters (window)", n(r.engagement.activeUsersInWindow));
    row("Clip views", n(r.engagement.clipViews));
    row("Median clips per session", r.engagement.medianClipsPerSession?.toString() ?? "-");
    row(
      "Watch time (all / window)",
      `${n(r.engagement.watchMinutesAllTime)} min / ${n(r.engagement.watchMinutesInWindow)} min`,
    );
    row(
      "Identifications (all / window)",
      `${n(r.engagement.identifications)} / ${n(r.engagement.identificationsInWindow)}`,
    );
    row("View → ID conversion", pctOrNull(r.engagement.viewToIdConversion), "IDs per clip viewed");
    if (r.engagement.topSources.length) {
      console.log("\n  \x1b[2mTop sources:\x1b[0m");
      for (const [label, count] of r.engagement.topSources) row(`  ${label}`, n(count));
    }
  }

  heading("Retention");
  row("Spotters with ≥1 ID", n(r.retention.spottersWithAnyId));
  row(
    "Came back on another day",
    n(r.retention.spottersWithMoreThanOneDay),
    pctOrNull(r.retention.returnRate) + " return rate",
  );
  row("Median active days", r.retention.medianActiveDays?.toString() ?? "-");
  row("Most active days by one spotter", n(r.retention.maxActiveDays));
  row(
    "Live streaks right now",
    n(r.retention.liveStreaks),
    r.retention.longestLiveStreak ? `longest ${r.retention.longestLiveStreak} days` : "",
  );
  row("Tide Freezes consumed", n(r.retention.tideFreezesConsumed));

  heading("Learning");
  row("Species unlocks", n(r.learning.speciesUnlocks));
  row(
    "Distinct species unlocked",
    `${n(r.learning.distinctSpeciesUnlocked)} / ${n(r.learning.catalogueSize)}`,
    "of the catalogue",
  );
  row("Median species per spotter", r.learning.medianSpeciesPerSpotter?.toString() ?? "-");
  row(
    "Consensus accuracy",
    pctOrNull(r.learning.consensusAccuracy),
    `${n(r.learning.settledIds)} settled IDs`,
  );
  if (r.learning.topAnswers.length) {
    console.log("\n  \x1b[2mMost-submitted IDs:\x1b[0m");
    for (const [label, count] of r.learning.topAnswers) row(`  ${label}`, n(count));
  }

  heading("Community consensus");
  row("Clips with ≥3 spotters", n(r.community.clipsEligibleForConsensus), "eligible for consensus");
  row(
    "Consensus reached",
    n(r.community.consensusReached),
    pct(r.community.consensusReached, r.community.clipsEligibleForConsensus) + " of eligible",
  );
  row("Answers retro-credited", n(r.community.answersRetroCredited));
  row("Median time to consensus", duration(r.community.medianTimeToConsensusMs));
  row("Contested clips", n(r.community.contestedClips), "community genuinely split");

  heading("Content & performance");
  row("Live clips", n(r.content.liveClips), `${n(r.content.excludedClips)} excluded`);
  row(
    "Sites",
    Object.entries(r.content.sites)
      .map(([k, v]) => `${k} (${v})`)
      .join(", ") || "-",
  );
  row("Catalogue species", n(r.learning.catalogueSize));
  for (const [name, v] of Object.entries(r.content.vitals)) {
    row(`${name} "good"`, pct(v.good, v.total), `${n(v.total)} samples`);
  }

  heading("Read these with the numbers");
  for (const c of r.caveats) {
    const words = c.split(" ");
    let line = "  ";
    for (const w of words) {
      if ((line + w).length > 76) {
        console.log(`  \x1b[2m${line.trim()}\x1b[0m`);
        line = "  ";
      }
      line += w + " ";
    }
    if (line.trim()) console.log(`  \x1b[2m${line.trim()}\x1b[0m`);
  }
  console.log();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Fail with the fix rather than a Prisma stack trace, this script is run
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

  const roundup = await computeRoundup(prisma, { windowDays });

  if (asJson) {
    console.log(JSON.stringify(roundup, null, 2));
    return;
  }

  printRoundup(roundup);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
