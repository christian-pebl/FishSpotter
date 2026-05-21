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
