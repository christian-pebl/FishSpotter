import { describe, expect, it } from "vitest";
import {
  PRIZE_TARGET_PEBBLES,
  SEASEARCH_GUIDE_ID,
  buildPrizeWinnerRows,
  hasReachedPrizeTarget,
  prizeContactState,
  toPrizeWinnerRow,
  type PrizeWinnerInput,
} from "./prize";

const winner = (over: Partial<PrizeWinnerInput> = {}): PrizeWinnerInput => ({
  userId: "u1",
  displayName: "Reef",
  name: null,
  email: "reef@example.com",
  isGuest: false,
  emailVerified: new Date("2026-07-01"),
  pebbles: 2400,
  claimedAt: null,
  fulfilledAt: null,
  fulfilledBy: null,
  eligible: true,
  eligibilityReasons: [],
  ...over,
});

describe("prize", () => {
  it("targets 2000 lifetime earned Pebbles", () => {
    expect(PRIZE_TARGET_PEBBLES).toBe(2000);
    expect(hasReachedPrizeTarget(1999)).toBe(false);
    expect(hasReachedPrizeTarget(2000)).toBe(true);
    expect(hasReachedPrizeTarget(2001)).toBe(true);
  });

  it("keeps a stable claim itemId that never collides with retired shop ids", () => {
    // Retired shop ids (gold-nameplate, coral-accent, tide-freeze) may exist
    // as PebblePurchase rows in prod; the prize must use a distinct id.
    expect(SEASEARCH_GUIDE_ID).toBe("seasearch-guide");
    expect(["gold-nameplate", "coral-accent", "tide-freeze"]).not.toContain(
      SEASEARCH_GUIDE_ID,
    );
  });
});

describe("prizeContactState", () => {
  it("never treats a guest's placeholder email as a contact", () => {
    // Guests carry a SYNTHETIC address, so a populated email column is not a
    // reachable one. This is the whole reason the state exists.
    const row = toPrizeWinnerRow(
      winner({ isGuest: true, email: "guest-abc123@fishspotter.local", emailVerified: null }),
    );
    expect(row.contact).toBe("guest");
    expect(row.contactEmail).toBeNull();
  });

  it("separates a real-but-unverified address from a verified one", () => {
    // guest-claim writes a real typed email with emailVerified left null: worth
    // showing (you can nudge them) but it can't clear the claim gate.
    expect(prizeContactState({ isGuest: false, emailVerified: null })).toBe("unverified");
    expect(prizeContactState({ isGuest: false, emailVerified: new Date() })).toBe("verified");
  });

  it("keeps a real email visible when unverified", () => {
    const row = toPrizeWinnerRow(winner({ emailVerified: null }));
    expect(row.contactEmail).toBe("reef@example.com");
  });
});

describe("prize winner status", () => {
  it("puts a claimed-but-unposted winner in the work queue", () => {
    expect(toPrizeWinnerRow(winner({ claimedAt: new Date() })).status).toBe("to-post");
  });

  it("marks a claim posted once fulfilledAt is stamped", () => {
    const row = toPrizeWinnerRow(
      winner({ claimedAt: new Date("2026-07-20"), fulfilledAt: new Date("2026-07-22") }),
    );
    expect(row.status).toBe("posted");
  });

  it("flags an over-target guest as unreachable, not merely unclaimed", () => {
    expect(toPrizeWinnerRow(winner({ isGuest: true })).status).toBe("unreachable");
  });

  it("falls back through displayName -> name -> a placeholder label", () => {
    expect(toPrizeWinnerRow(winner({ displayName: "  ", name: "Sam" })).spotter).toBe("Sam");
    expect(toPrizeWinnerRow(winner({ displayName: null, name: null })).spotter).toBe(
      "Unnamed spotter",
    );
  });
});

describe("buildPrizeWinnerRows", () => {
  it("excludes spotters below the target", () => {
    const rows = buildPrizeWinnerRows([
      winner({ userId: "under", pebbles: PRIZE_TARGET_PEBBLES - 1 }),
      winner({ userId: "at", pebbles: PRIZE_TARGET_PEBBLES }),
    ]);
    expect(rows.map((r) => r.userId)).toEqual(["at"]);
  });

  it("keeps a claimed row even if the total somehow falls below target", () => {
    // PEBL still owes them a book — a claim must never silently vanish.
    const rows = buildPrizeWinnerRows([winner({ pebbles: 10, claimedAt: new Date() })]);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("to-post");
  });

  it("orders by work-to-do first, then Pebbles descending", () => {
    const rows = buildPrizeWinnerRows([
      winner({ userId: "posted", pebbles: 9000, claimedAt: new Date(), fulfilledAt: new Date() }),
      winner({ userId: "guest", pebbles: 8000, isGuest: true }),
      winner({ userId: "unclaimed-lo", pebbles: 2100 }),
      winner({ userId: "unclaimed-hi", pebbles: 5000 }),
      winner({ userId: "to-post", pebbles: 2000, claimedAt: new Date() }),
    ]);
    expect(rows.map((r) => r.userId)).toEqual([
      "to-post",
      "unclaimed-hi",
      "unclaimed-lo",
      "guest",
      "posted",
    ]);
  });
});
