/**
 * New-clip notifications (2026-08-13).
 *
 * Built after the app's top spotter (73 of 73 clips answered) emailed to say
 * voting had "stopped working". Nothing was broken: they had cleared the feed,
 * and because FeedCard only renders the quiz when the viewer has no answer for
 * that clip, every card showed a reveal with no vote affordance and no
 * explanation. Two gaps, one root cause. The app had nothing to say to a
 * spotter who finishes, and no way to tell them when more footage lands.
 *
 * This module is the single definition of "a new clip" shared by all three
 * consumers (the in-app banner, the end-of-feed card, and the outbound cron),
 * so they can never disagree about the count.
 *
 * The load-bearing detail is `excludeBlockedSnippetsWhere()`. A clip can exist
 * in the DB but be hidden from every user-facing surface (TRDesk4's exclude
 * toggle, or the static blocklist). 24 of the 97 rows are hidden today. Counting
 * raw `Snippet.createdAt` without that filter promises footage the spotter will
 * never be shown, which is exactly the "you lied to me" bug an engagement email
 * can least afford.
 */

import type { PrismaClient } from "@prisma/client";
import { excludeBlockedSnippetsWhere } from "@/lib/snippet-blocklist";

/** Sites named individually in the email before collapsing to "and N more". */
export const MAX_SITES_LISTED = 3;

export interface NewClipSummary {
  /** How many feed-visible clips landed since the watermark. */
  count: number;
  /** Distinct place names those clips came from, newest first, deduped. */
  sites: string[];
}

/**
 * Reduce a stored site to just its place name.
 *
 * `Snippet.site` holds a full location string ("Bideford Bay, North Devon, UK"),
 * which is right for the clip metadata panel and wrong for a comma-separated
 * list: joining three of them raw produced
 * "Freshwater West, Pembrokeshire, Wales, UK, Bideford Bay, North Devon, UK, ..."
 * where no reader can tell which commas separate sites and which separate
 * counties. The leading segment is the recognisable bit, so that is what the
 * email says.
 */
export function shortSiteName(site: string): string {
  return site.split(",")[0]?.trim() ?? "";
}

/**
 * Distinct place names from a set of clips, in the order given (callers pass
 * newest first). Shared by the summary helper and the cron so both label a
 * batch identically.
 */
export function collectSiteNames(clips: Array<{ site: string | null }>): string[] {
  const names: string[] = [];
  for (const c of clips) {
    const name = shortSiteName(c.site ?? "");
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

/**
 * The watermark a spotter's "new since" count is measured from.
 *
 * Falls back to the account creation date when the stamp is null, so a
 * pre-existing user (every user, the day this ships) is not greeted with a
 * banner claiming the entire back catalogue is new. A brand-new account
 * likewise starts at zero rather than "73 new clips".
 */
export function newClipBaseline(user: {
  lastFeedSeenAt?: Date | null;
  createdAt: Date;
}): Date {
  return user.lastFeedSeenAt ?? user.createdAt;
}

/** Count the feed-visible clips added since `since`. */
export async function countNewClipsSince(
  prisma: PrismaClient,
  since: Date,
): Promise<number> {
  return prisma.snippet.count({
    where: { ...excludeBlockedSnippetsWhere(), createdAt: { gt: since } },
  });
}

/**
 * Count + name the sites of the feed-visible clips added since `since`.
 * Used by the outbound email, which is more compelling when it can say where
 * the footage is from rather than just how much of it there is.
 */
export async function summariseNewClipsSince(
  prisma: PrismaClient,
  since: Date,
): Promise<NewClipSummary> {
  const rows = await prisma.snippet.findMany({
    where: { ...excludeBlockedSnippetsWhere(), createdAt: { gt: since } },
    select: { site: true },
    orderBy: { createdAt: "desc" },
  });
  return { count: rows.length, sites: collectSiteNames(rows) };
}

/**
 * Human phrase for a set of sites: "Loch Sunart", "Loch Sunart and Bideford
 * Bay", "Loch Sunart, Bideford Bay and 3 more". Pure, so it is unit-tested
 * rather than eyeballed in a rendered email.
 */
export function describeSites(sites: string[], max: number = MAX_SITES_LISTED): string {
  const named = sites.slice(0, max);
  if (named.length === 0) return "";
  const remainder = sites.length - named.length;
  if (remainder > 0) {
    return `${named.join(", ")} and ${remainder} more`;
  }
  if (named.length === 1) return named[0];
  return `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}`;
}

/** "1 new clip" / "12 new clips". */
export function pluraliseClips(count: number): string {
  return `${count} new clip${count === 1 ? "" : "s"}`;
}
