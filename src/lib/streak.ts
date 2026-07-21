/**
 * Daily-streak calculation, shared between `GET /api/streak` and
 * `POST /api/answers` (S2-T04). Pure with respect to the date set so
 * unit tests can exercise it without spinning up Prisma.
 *
 * A streak is the number of consecutive UTC days ending at "today or
 * yesterday" on which the user submitted at least one answer. If the
 * most recent activity is older than yesterday, the streak is 0.
 */

export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (parseDateKey(a).getTime() - parseDateKey(b).getTime()) /
      (24 * 60 * 60 * 1000),
  );
}

export interface StreakResult {
  currentStreak: number;
  lastActivityDate: string | null;
}

/**
 * Compute the streak from a set of date strings (YYYY-MM-DD). Caller is
 * responsible for deriving the date set from Answer rows.
 *
 * `now` is an optional override for testing — when not supplied, the
 * current UTC date is used.
 */
export function computeStreakFromDates(
  dates: Iterable<string>,
  now: Date = new Date(),
): StreakResult {
  const sorted = Array.from(new Set(dates)).sort().reverse();
  if (sorted.length === 0) {
    return { currentStreak: 0, lastActivityDate: null };
  }

  const today = toDateKey(now);
  const yesterday = toDateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const last = sorted[0];
  if (last !== today && last !== yesterday) {
    return { currentStreak: 0, lastActivityDate: last };
  }

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (daysBetween(sorted[i - 1], sorted[i]) === 1) {
      streak++;
    } else {
      break;
    }
  }

  return { currentStreak: streak, lastActivityDate: sorted[0] };
}

/**
 * Convenience: take Answer-shaped rows (with `createdAt: Date`) and
 * compute the streak directly. Used by both the GET /api/streak route
 * and the POST /api/answers route.
 */
export function computeStreakFromAnswers(
  answers: Array<{ createdAt: Date }>,
  now: Date = new Date(),
): StreakResult {
  return computeStreakFromDates(
    answers.map((a) => toDateKey(a.createdAt)),
    now,
  );
}

// ---------------------------------------------------------------------------
// Tide Freeze — freeze-aware streak (retired shop consumable; held freezes still honoured)
// ---------------------------------------------------------------------------

function prevDay(key: string): string {
  return toDateKey(new Date(parseDateKey(key).getTime() - 24 * 60 * 60 * 1000));
}

export interface FreezeState {
  /** Count of unused ("held") Tide Freezes the spotter owns. */
  availableFreezes: number;
  /** UTC date-keys (YYYY-MM-DD) already covered by a spent freeze. A day here is
   *  bridged for free (its freeze was consumed on a previous pass). */
  protectedDates: ReadonlySet<string>;
}

export interface FreezeStreakResult extends StreakResult {
  /** Missed days newly bridged by spending a held freeze on THIS pass. The
   *  caller (the answers route) persists these by stamping that many held
   *  freezes with the date, so the bridge is permanent on later recomputes. */
  newlyProtectedDates: string[];
}

/**
 * Like computeStreakFromDates, but a missed day can be bridged if it is already
 * protected (a freeze was spent on it before) or by spending one of the held
 * `availableFreezes`. Greedy from the most recent day: it first reconnects the
 * latest activity to the today/yesterday window, then bridges internal gaps,
 * stopping when a missed day cannot be covered. Pure — persistence of the
 * spent freezes is the caller's job (via newlyProtectedDates).
 */
export function computeStreakWithFreezes(
  dates: Iterable<string>,
  freeze: FreezeState,
  now: Date = new Date(),
): FreezeStreakResult {
  const sorted = Array.from(new Set(dates)).sort().reverse();
  if (sorted.length === 0) {
    return { currentStreak: 0, lastActivityDate: null, newlyProtectedDates: [] };
  }

  const today = toDateKey(now);
  const yesterday = toDateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));

  let available = freeze.availableFreezes;
  const newlyProtected: string[] = [];
  // Cover one specific missed day: free if already protected, else spend a held
  // freeze (recording it). Returns false when none are left.
  const cover = (day: string): boolean => {
    if (freeze.protectedDates.has(day)) return true;
    if (available > 0) {
      available -= 1;
      newlyProtected.push(day);
      return true;
    }
    return false;
  };

  const broken: FreezeStreakResult = {
    currentStreak: 0,
    lastActivityDate: sorted[0],
    newlyProtectedDates: [],
  };

  // 1) Reconnect the most recent activity to the today/yesterday window.
  const last = sorted[0];
  if (last !== today && last !== yesterday) {
    let cursor = yesterday;
    while (cursor !== last) {
      if (!cover(cursor)) return broken;
      cursor = prevDay(cursor);
    }
  }

  // 2) Walk consecutive activity days, bridging internal gaps.
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const gap = daysBetween(sorted[i - 1], sorted[i]); // >= 1
    if (gap === 1) {
      streak += 1;
      continue;
    }
    let cursor = prevDay(sorted[i - 1]);
    let bridged = true;
    for (let k = 0; k < gap - 1; k++) {
      if (!cover(cursor)) {
        bridged = false;
        break;
      }
      cursor = prevDay(cursor);
    }
    if (!bridged) break;
    streak += 1;
  }

  return { currentStreak: streak, lastActivityDate: sorted[0], newlyProtectedDates: newlyProtected };
}
