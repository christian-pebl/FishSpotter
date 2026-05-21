import { describe, expect, it } from "vitest";
import {
  computeStreakFromAnswers,
  computeStreakFromDates,
  toDateKey,
} from "./streak";

const NOW = new Date("2026-05-21T12:00:00Z");
const today = "2026-05-21";
const yesterday = "2026-05-20";
const dayBefore = "2026-05-19";
const dayBeforeThat = "2026-05-18";

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
