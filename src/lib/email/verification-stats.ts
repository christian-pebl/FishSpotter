/**
 * "Are verification emails getting through?" answered from data the app
 * already keeps, with no access to SendGrid at all.
 *
 * Every verification send mints one VerificationToken row; clicking the link
 * stamps `consumedAt` and, in the same transaction, `User.emailVerified`. So
 * over any window, requested = rows created and clicked = rows consumed by a
 * click, and a run of requests with no clicks is the signature of a provider
 * that is configured but not delivering (or of links landing in spam). That
 * is exactly the failure that produced the 8 Sep 2026 support message, and it
 * was invisible: nothing counted it.
 *
 * "Consumed by a click" needs one more test than `consumedAt !== null`. Until
 * the same change that added this file, a RESEND stamped the previous token
 * consumed too (kept "as an audit trail"), so an unverified spotter who pressed
 * resend five times left four consumed rows nobody ever clicked. A click is
 * the only path that also sets `User.emailVerified`, a millisecond apart, so a
 * consumed token whose user's `emailVerified` sits within CLICK_MATCH_MS of it
 * was clicked; anything else was superseded. Rows minted after the change are
 * unambiguous either way, and the heuristic keeps the older rows honest.
 *
 * Pure: the admin page passes in the rows, the test passes in fixtures.
 */

export interface VerificationTokenRow {
  createdAt: Date;
  consumedAt: Date | null;
  expiresAt: Date;
  /** `User.emailVerified` of the token's owner, as it stands now. */
  userEmailVerified: Date | null;
}

export interface VerificationWindow {
  days: number;
  /** Verification emails the app tried to send (one token each). */
  requested: number;
  /** Of those, links that were clicked. */
  clicked: number;
}

export type VerificationVerdict = "no-data" | "delivering" | "partial" | "not-delivering";

export interface VerificationStats {
  windows: VerificationWindow[];
  /** Unconsumed, unexpired links right now: people who could still click. */
  outstanding: number;
  /** Read off the longest window. */
  verdict: VerificationVerdict;
}

export const VERIFICATION_STAT_WINDOWS = [7, 30] as const;

/**
 * Below this many requests in the longest window the page says nothing. Two
 * unclicked links could be two people who never looked, three in a row with
 * nothing clicked starts to look like the sender.
 */
export const MIN_REQUESTS_FOR_VERDICT = 3;

/** A click's `consumedAt` and the user's `emailVerified` are two `new Date()` calls in one transaction. */
export const CLICK_MATCH_MS = 5_000;

const DAY_MS = 24 * 60 * 60 * 1000;

export function wasClicked(row: VerificationTokenRow): boolean {
  if (!row.consumedAt || !row.userEmailVerified) return false;
  return Math.abs(row.userEmailVerified.getTime() - row.consumedAt.getTime()) <= CLICK_MATCH_MS;
}

export function summariseVerificationTokens(
  rows: VerificationTokenRow[],
  now: Date,
): VerificationStats {
  const nowMs = now.getTime();
  const windows: VerificationWindow[] = VERIFICATION_STAT_WINDOWS.map((days) => {
    const since = nowMs - days * DAY_MS;
    const inWindow = rows.filter((r) => {
      const t = r.createdAt.getTime();
      return t >= since && t <= nowMs;
    });
    return {
      days,
      requested: inWindow.length,
      clicked: inWindow.filter(wasClicked).length,
    };
  });

  const outstanding = rows.filter(
    (r) => r.consumedAt === null && r.expiresAt.getTime() > nowMs,
  ).length;

  const longest = windows[windows.length - 1];
  let verdict: VerificationVerdict;
  if (longest.requested < MIN_REQUESTS_FOR_VERDICT) verdict = "no-data";
  else if (longest.clicked === 0) verdict = "not-delivering";
  else if (longest.clicked * 2 < longest.requested) verdict = "partial";
  else verdict = "delivering";

  return { windows, outstanding, verdict };
}
