import { describe, expect, it } from "vitest";
import { markPrizeFulfilled, toPrizeDeskSummary, type PrizeDeskSummaryWinner } from "./prize-desk";
import { SEASEARCH_GUIDE_ID, type PrizeWinnerRow } from "./prize";

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
  status: "to-post",
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

/**
 * markPrizeFulfilled's branching, against a hand-rolled fake Prisma.
 *
 * The real-database coverage lives in prize-desk.integration.test.ts, which is
 * skipped unless PRIZE_TEST_DATABASE_URL is set, so on a normal `npm test`
 * (and in CI) nothing executed this function at all. Since the create-on-demand
 * branch is the whole point of the 11 Aug 2026 refactor, and getting it wrong
 * means either a book that can't be recorded or a duplicate posting, it needs
 * coverage that always runs.
 */
describe("markPrizeFulfilled", () => {
  function fakePrisma(existing: { id: string } | null) {
    const calls = { create: [] as unknown[], update: [] as unknown[] };
    const prisma = {
      pebblePurchase: {
        findFirst: async () => existing,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          calls.create.push(data);
          return { fulfilledAt: data.fulfilledAt, fulfilledBy: data.fulfilledBy };
        },
        update: async ({ data, where }: { data: Record<string, unknown>; where: unknown }) => {
          calls.update.push({ data, where });
          return { fulfilledAt: data.fulfilledAt, fulfilledBy: data.fulfilledBy };
        },
      },
    } as unknown as Parameters<typeof markPrizeFulfilled>[0];
    return { prisma, calls };
  }

  it("creates a zero-cost fulfilment row when the winner has none", async () => {
    const { prisma, calls } = fakePrisma(null);
    const res = await markPrizeFulfilled(prisma, "u1", true, "chris@pebl-cic.co.uk");

    expect(calls.create).toHaveLength(1);
    expect(calls.update).toHaveLength(0);
    expect(calls.create[0]).toMatchObject({
      userId: "u1",
      itemId: SEASEARCH_GUIDE_ID,
      // Load-bearing: the guide is a gift, so recording it must never look
      // like a spend against the spotter's Pebbles.
      pebbleCost: 0,
      fulfilledBy: "chris@pebl-cic.co.uk",
    });
    expect(res.fulfilledAt).toBeInstanceOf(Date);
  });

  it("updates in place when a row already exists, never creating a second", async () => {
    const { prisma, calls } = fakePrisma({ id: "row1" });
    await markPrizeFulfilled(prisma, "u1", true, "chris@pebl-cic.co.uk");

    expect(calls.create).toHaveLength(0);
    expect(calls.update).toHaveLength(1);
    expect(calls.update[0]).toMatchObject({ where: { id: "row1" } });
  });

  it("un-marking with no existing row writes nothing at all", async () => {
    // Otherwise the desk would litter the ledger with rows recording that a
    // book was NOT sent, and every one of them would resurface as a winner.
    const { prisma, calls } = fakePrisma(null);
    const res = await markPrizeFulfilled(prisma, "u1", false, "chris@pebl-cic.co.uk");

    expect(calls.create).toHaveLength(0);
    expect(calls.update).toHaveLength(0);
    expect(res).toEqual({ fulfilledAt: null, fulfilledBy: null });
  });

  it("un-marking an existing row clears the stamp but keeps the row", async () => {
    const { prisma, calls } = fakePrisma({ id: "row1" });
    const res = await markPrizeFulfilled(prisma, "u1", false, "chris@pebl-cic.co.uk");

    expect(calls.update).toHaveLength(1);
    expect(calls.update[0]).toMatchObject({
      data: { fulfilledAt: null, fulfilledBy: null },
    });
    expect(res.fulfilledAt).toBeNull();
  });
});
