/**
 * Server-side glue between the Tide Freeze shop consumable and the day-streak.
 * Keeps the freeze bookkeeping (which held freezes are spent, on which dates) in
 * one place so every streak read (profile, hub banner, /api/streak) and the one
 * writer (/api/answers) agree. The streak MATH stays pure in streak.ts; this
 * layer only loads/persists PebblePurchase rows.
 */

import type { PrismaClient } from "@prisma/client";
import {
  computeStreakWithFreezes,
  type FreezeState,
  toDateKey,
} from "@/lib/streak";

/**
 * PebblePurchase.itemId of the RETIRED Tide Freeze shop consumable (the shop
 * was removed 20 Jul 2026). Freezes bought before retirement are still
 * honoured here — a held freeze keeps protecting a missed day; there is just
 * no way to buy more. The id must never be reused.
 */
export const TIDE_FREEZE_ID = "tide-freeze";

interface LoadedFreezes {
  state: FreezeState;
  /** Ids of the held (unspent) freezes, oldest first — the order they're spent. */
  availableIds: string[];
}

/** Read a spotter's Tide Freeze position: how many are held + which dates are
 *  already protected by a spent one. */
export async function loadFreezeState(
  prisma: PrismaClient,
  userId: string,
): Promise<LoadedFreezes> {
  const rows = await prisma.pebblePurchase.findMany({
    where: { userId, itemId: TIDE_FREEZE_ID },
    select: { id: true, consumedForDate: true, purchasedAt: true },
    orderBy: { purchasedAt: "asc" },
  });
  const availableIds: string[] = [];
  const protectedDates = new Set<string>();
  for (const r of rows) {
    if (r.consumedForDate) protectedDates.add(r.consumedForDate);
    else availableIds.push(r.id);
  }
  return { state: { availableFreezes: availableIds.length, protectedDates }, availableIds };
}

/** Read-only freeze-aware current streak for display (does not spend freezes). */
export async function readStreak(
  prisma: PrismaClient,
  userId: string,
  dates: string[],
  now: Date = new Date(),
): Promise<number> {
  const { state } = await loadFreezeState(prisma, userId);
  return computeStreakWithFreezes(dates, state, now).currentStreak;
}

/**
 * Compute the freeze-aware streak AND persist any freezes newly spent to bridge
 * a missed day (stamping the oldest held freezes with the protected date). Call
 * from the single writer path (/api/answers). Returns the current streak.
 */
export async function settleStreak(
  prisma: PrismaClient,
  userId: string,
  dates: string[],
  now: Date = new Date(),
): Promise<number> {
  const { state, availableIds } = await loadFreezeState(prisma, userId);
  const result = computeStreakWithFreezes(dates, state, now);
  if (result.newlyProtectedDates.length > 0) {
    await prisma.$transaction(
      result.newlyProtectedDates.map((date, i) =>
        prisma.pebblePurchase.update({
          where: { id: availableIds[i] },
          data: { consumedForDate: date },
        }),
      ),
    );
  }
  return result.currentStreak;
}

/** Convenience for callers holding Answer rows rather than date-keys. */
export function datesFromAnswers(answers: Array<{ createdAt: Date }>): string[] {
  return answers.map((a) => toDateKey(a.createdAt));
}
