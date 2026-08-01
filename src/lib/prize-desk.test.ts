import { describe, expect, it } from "vitest";
import { toPrizeDeskSummary, type PrizeDeskSummaryWinner } from "./prize-desk";
import type { PrizeWinnerRow } from "./prize";

const row = (over: Partial<PrizeWinnerRow> = {}): PrizeWinnerRow => ({
  userId: "u1",
  displayName: "Reef",
  name: null,
  email: "reef@example.com",
  isGuest: false,
  emailVerified: new Date("2026-07-01T00:00:00Z"),
  pebbles: 2400,
  claimedAt: null,
  fulfilledAt: null,
  fulfilledBy: null,
  eligible: true,
  eligibilityReasons: [],
  status: "reached-unclaimed",
  contact: "verified",
  contactEmail: "reef@example.com",
  spotter: "Reef",
  ...over,
});

describe("toPrizeDeskSummary", () => {
  it("serializes every Date field to an ISO string", () => {
    const { winners } = toPrizeDeskSummary([
      row({
        emailVerified: new Date("2026-07-01T00:00:00Z"),
        claimedAt: new Date("2026-07-25T09:00:00Z"),
        fulfilledAt: new Date("2026-07-26T10:00:00Z"),
      }),
    ]);
    expect(winners[0].emailVerified).toBe("2026-07-01T00:00:00.000Z");
    expect(winners[0].claimedAt).toBe("2026-07-25T09:00:00.000Z");
    expect(winners[0].fulfilledAt).toBe("2026-07-26T10:00:00.000Z");
  });

  it("carries null dates through as null, not a crash", () => {
    const { winners } = toPrizeDeskSummary([
      row({ emailVerified: null, claimedAt: null, fulfilledAt: null }),
    ]);
    expect(winners[0].emailVerified).toBeNull();
    expect(winners[0].claimedAt).toBeNull();
    expect(winners[0].fulfilledAt).toBeNull();
  });

  it("reports the count alongside the array", () => {
    const { count, winners } = toPrizeDeskSummary([row(), row({ userId: "u2" })]);
    expect(count).toBe(2);
    expect(winners).toHaveLength(2);
  });

  it("is an explicit allow-list: only the documented fields ever appear", () => {
    // This is the actual security contract. PrizeWinnerRow carries `email`
    // and `displayName`/`name` too (raw User columns) — if toPrizeDeskSummary
    // ever changed to `...row` those would leak into a PII-carrying response
    // without a deliberate review. Pin the exact key set.
    const { winners } = toPrizeDeskSummary([row()]);
    const keys = Object.keys(winners[0]).sort();
    const expected: (keyof PrizeDeskSummaryWinner)[] = [
      "claimedAt",
      "contact",
      "contactEmail",
      "eligibilityReasons",
      "eligible",
      "emailVerified",
      "fulfilledAt",
      "fulfilledBy",
      "isGuest",
      "pebbles",
      "spotter",
      "status",
      "userId",
    ];
    expect(keys).toEqual(expected.slice().sort());
  });

  it("never exposes a guest's raw placeholder email, only via contactEmail=null", () => {
    // toPrizeWinnerRow already nulls contactEmail for guests (prize.test.ts);
    // this asserts the summary doesn't reintroduce it through some other key.
    const { winners } = toPrizeDeskSummary([
      row({
        isGuest: true,
        contact: "guest",
        contactEmail: null,
        email: "guest-abc123@fishspotter.local",
      }),
    ]);
    const serialized = JSON.stringify(winners[0]);
    expect(serialized).not.toContain("fishspotter.local");
    expect(winners[0].contactEmail).toBeNull();
  });
});
