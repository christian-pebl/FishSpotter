import { describe, expect, it } from "vitest";
import {
  CLICK_MATCH_MS,
  MIN_REQUESTS_FOR_VERDICT,
  summariseVerificationTokens,
  wasClicked,
  type VerificationTokenRow,
} from "./verification-stats";

const NOW = new Date("2026-09-08T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * DAY);
}

/** A token minted `ageDays` ago that nobody has clicked. */
function unclicked(ageDays: number): VerificationTokenRow {
  const createdAt = daysAgo(ageDays);
  return {
    createdAt,
    consumedAt: null,
    expiresAt: new Date(createdAt.getTime() + DAY),
    userEmailVerified: null,
  };
}

/** A token minted `ageDays` ago whose link was clicked an hour later. */
function clicked(ageDays: number): VerificationTokenRow {
  const createdAt = daysAgo(ageDays);
  const consumedAt = new Date(createdAt.getTime() + 60 * 60 * 1000);
  return {
    createdAt,
    consumedAt,
    expiresAt: new Date(createdAt.getTime() + DAY),
    // The verify route stamps both in one transaction, a millisecond apart.
    userEmailVerified: new Date(consumedAt.getTime() + 2),
  };
}

/**
 * A token stamped consumed by a RESEND (the pre-fix behaviour), not by a
 * click: the owner is still unverified.
 */
function superseded(ageDays: number): VerificationTokenRow {
  const createdAt = daysAgo(ageDays);
  return {
    createdAt,
    consumedAt: new Date(createdAt.getTime() + 5 * 60 * 1000),
    expiresAt: new Date(createdAt.getTime() + DAY),
    userEmailVerified: null,
  };
}

describe("wasClicked", () => {
  it("counts a consumed token only when the owner was verified at that moment", () => {
    expect(wasClicked(clicked(1))).toBe(true);
    expect(wasClicked(unclicked(1))).toBe(false);
    expect(wasClicked(superseded(1))).toBe(false);
  });

  it("does not credit a click to a token consumed long after the owner verified", () => {
    // Verified via an earlier link; this later one was consumed by something else.
    const row = clicked(1);
    row.userEmailVerified = new Date(row.consumedAt!.getTime() - CLICK_MATCH_MS - 1);
    expect(wasClicked(row)).toBe(false);
  });
});

describe("summariseVerificationTokens", () => {
  it("says nothing on too little data", () => {
    const stats = summariseVerificationTokens([unclicked(1), unclicked(2)], NOW);
    expect(MIN_REQUESTS_FOR_VERDICT).toBe(3);
    expect(stats.verdict).toBe("no-data");
    expect(stats.windows.map((w) => w.days)).toEqual([7, 30]);
  });

  it("calls a run of requests with no clicks not delivering", () => {
    // Five spotters (or one spotter, five times) asked; nobody could click.
    const rows = [unclicked(1), unclicked(2), unclicked(3), unclicked(10), unclicked(20)];
    const stats = summariseVerificationTokens(rows, NOW);
    expect(stats.windows).toEqual([
      { days: 7, requested: 3, clicked: 0 },
      { days: 30, requested: 5, clicked: 0 },
    ]);
    expect(stats.verdict).toBe("not-delivering");
  });

  it("does not mistake resend-superseded tokens for clicks", () => {
    // The pre-fix resend route stamped the previous token consumed. Without the
    // emailVerified cross-check these four would read as an 80% click rate.
    const rows = [superseded(1), superseded(1), superseded(1), superseded(1), unclicked(1)];
    const stats = summariseVerificationTokens(rows, NOW);
    expect(stats.windows[1]).toEqual({ days: 30, requested: 5, clicked: 0 });
    expect(stats.verdict).toBe("not-delivering");
  });

  it("calls a healthy click rate delivering, and a poor one partial", () => {
    const healthy = [clicked(1), clicked(2), unclicked(3), clicked(4)];
    expect(summariseVerificationTokens(healthy, NOW).verdict).toBe("delivering");

    const poor = [clicked(1), unclicked(2), unclicked(3), unclicked(4), unclicked(5)];
    const stats = summariseVerificationTokens(poor, NOW);
    expect(stats.windows[1]).toEqual({ days: 30, requested: 5, clicked: 1 });
    expect(stats.verdict).toBe("partial");
  });

  it("windows by creation time and ignores tokens older than the longest window", () => {
    const rows = [clicked(0.5), clicked(6.9), clicked(7.1), clicked(29), clicked(31)];
    const stats = summariseVerificationTokens(rows, NOW);
    expect(stats.windows).toEqual([
      { days: 7, requested: 2, clicked: 2 },
      { days: 30, requested: 4, clicked: 4 },
    ]);
  });

  it("counts only live, unconsumed links as outstanding", () => {
    // Minted 12h ago (24h TTL): still clickable. Minted 2 days ago: expired.
    const rows = [unclicked(0.5), unclicked(2), clicked(0.5), superseded(0.5)];
    expect(summariseVerificationTokens(rows, NOW).outstanding).toBe(1);
  });
});
