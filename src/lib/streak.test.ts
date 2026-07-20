import { describe, expect, it } from "vitest";
import {
  computeStreakFromAnswers,
  computeStreakFromDates,
  computeStreakWithFreezes,
  toDateKey,
} from "./streak";

const NOW = new Date("2026-05-21T12:00:00Z");
const today = "2026-05-21";
const yesterday = "2026-05-20";
const dayBefore = "2026-05-19";
const dayBeforeThat = "2026-05-18";

const noFreeze = { availableFreezes: 0, protectedDates: new Set<string>() };

function dt(s: string): Date {
  return new Date(`${s}T08:00:00Z`);
}

describe("toDateKey", () => {
  it("returns the YYYY-MM-DD slice in UTC", () => {
    expect(toDateKey(NOW)).toBe(today);
  });
});

describe("computeStreakFromDates", () => {
  it("returns 0 when there's no activity", () => {
    expect(computeStreakFromDates([], NOW)).toEqual({
      currentStreak: 0,
      lastActivityDate: null,
    });
  });

  it("returns 0 when the most recent activity is older than yesterday", () => {
    expect(computeStreakFromDates(["2026-05-15"], NOW)).toEqual({
      currentStreak: 0,
      lastActivityDate: "2026-05-15",
    });
  });

  it("counts a single day's activity (today)", () => {
    expect(computeStreakFromDates([today], NOW)).toEqual({
      currentStreak: 1,
      lastActivityDate: today,
    });
  });

  it("counts a single day's activity (yesterday)", () => {
    expect(computeStreakFromDates([yesterday], NOW)).toEqual({
      currentStreak: 1,
      lastActivityDate: yesterday,
    });
  });

  it("counts consecutive days backwards", () => {
    expect(
      computeStreakFromDates(
        [today, yesterday, dayBefore, dayBeforeThat],
        NOW,
      ),
    ).toEqual({ currentStreak: 4, lastActivityDate: today });
  });

  it("stops at a gap", () => {
    expect(
      computeStreakFromDates(
        [today, yesterday, "2026-05-15"], // gap between yesterday and the 15th
        NOW,
      ),
    ).toEqual({ currentStreak: 2, lastActivityDate: today });
  });

  it("dedupes repeated days", () => {
    expect(
      computeStreakFromDates([today, today, yesterday, yesterday], NOW),
    ).toEqual({ currentStreak: 2, lastActivityDate: today });
  });
});

describe("computeStreakFromAnswers", () => {
  it("derives the date set from createdAt", () => {
    const answers = [{ createdAt: dt(today) }, { createdAt: dt(yesterday) }];
    expect(computeStreakFromAnswers(answers, NOW)).toEqual({
      currentStreak: 2,
      lastActivityDate: today,
    });
  });

  it("matches the GET /api/streak contract for an empty set", () => {
    expect(computeStreakFromAnswers([], NOW)).toEqual({
      currentStreak: 0,
      lastActivityDate: null,
    });
  });
});

describe("computeStreakWithFreezes", () => {
  it("matches the plain streak when no freeze is needed", () => {
    const r = computeStreakWithFreezes([today, yesterday, dayBefore], noFreeze, NOW);
    expect(r.currentStreak).toBe(3);
    expect(r.newlyProtectedDates).toEqual([]);
  });

  it("without a freeze, a missed day still breaks the streak", () => {
    // Last activity was the day before yesterday (yesterday missed).
    const r = computeStreakWithFreezes([dayBefore, dayBeforeThat], noFreeze, NOW);
    expect(r.currentStreak).toBe(0);
  });

  it("spends a held freeze to bridge the missed day and keep the streak alive", () => {
    const r = computeStreakWithFreezes(
      [dayBefore, dayBeforeThat],
      { availableFreezes: 1, protectedDates: new Set() },
      NOW,
    );
    // dayBefore + dayBeforeThat = 2 activity days, yesterday bridged by a freeze.
    expect(r.currentStreak).toBe(2);
    expect(r.newlyProtectedDates).toEqual([yesterday]);
  });

  it("treats an already-protected day as free (spends no new freeze)", () => {
    const r = computeStreakWithFreezes(
      [dayBefore, dayBeforeThat],
      { availableFreezes: 0, protectedDates: new Set([yesterday]) },
      NOW,
    );
    expect(r.currentStreak).toBe(2);
    expect(r.newlyProtectedDates).toEqual([]);
  });

  it("bridges an internal gap with a freeze", () => {
    // today, yesterday, [gap: dayBefore missed], dayBeforeThat
    const r = computeStreakWithFreezes(
      [today, yesterday, dayBeforeThat],
      { availableFreezes: 1, protectedDates: new Set() },
      NOW,
    );
    expect(r.currentStreak).toBe(3);
    expect(r.newlyProtectedDates).toEqual([dayBefore]);
  });

  it("breaks when there aren't enough freezes for consecutive missed days", () => {
    // last activity 3 days before today = two missed days (yesterday + dayBefore).
    const r = computeStreakWithFreezes(
      ["2026-05-18"],
      { availableFreezes: 1, protectedDates: new Set() },
      NOW,
    );
    expect(r.currentStreak).toBe(0);
    // A broken streak spends nothing.
    expect(r.newlyProtectedDates).toEqual([]);
  });

  it("never spends more than one freeze per missed day", () => {
    const r = computeStreakWithFreezes(
      ["2026-05-18"],
      { availableFreezes: 2, protectedDates: new Set() },
      NOW,
    );
    // Two missed days, two freezes -> alive, exactly two spent.
    expect(r.currentStreak).toBe(1);
    expect(r.newlyProtectedDates).toEqual([yesterday, dayBefore]);
  });
});
