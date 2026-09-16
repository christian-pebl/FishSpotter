import { describe, expect, it } from "vitest";
import { prizeClaimStatus, type PrizeClaimInput } from "./prize-requirements";
import { PRIZE_TARGET_PEBBLES } from "./prize";
import {
  PRIZE_MIN_ACTIVE_DAYS,
  PRIZE_MIN_ACTIVITY_SPAN_DAYS,
  PRIZE_TRUST_BAR,
  isPrizeEligible,
} from "./trust";

const DAY_MS = 86_400_000;
const now = new Date("2026-09-16T12:00:00Z");

/** Five separate days, 17 days apart end to end: clears both activity rules. */
const spread = [
  new Date("2026-08-20T10:00:00Z"),
  new Date("2026-08-24T10:00:00Z"),
  new Date("2026-08-29T10:00:00Z"),
  new Date("2026-09-02T10:00:00Z"),
  new Date("2026-09-06T10:00:00Z"),
];

const ready: PrizeClaimInput = {
  earned: PRIZE_TARGET_PEBBLES,
  isGuest: false,
  emailVerified: new Date("2026-08-01T00:00:00Z"),
  createdAt: new Date("2026-08-01T00:00:00Z"),
  trustScore: 100,
  answerDates: spread,
};

function req(input: PrizeClaimInput, id: string) {
  const found = prizeClaimStatus(input, now).requirements.find((r) => r.id === id);
  if (!found) throw new Error(`no requirement ${id}`);
  return found;
}

describe("prizeClaimStatus", () => {
  it("lists the four requirements in display order", () => {
    const ids = prizeClaimStatus(ready, now).requirements.map((r) => r.id);
    expect(ids).toEqual(["pebbles", "account", "days", "span"]);
  });

  it("is eligible with every requirement met and nothing pending", () => {
    const s = prizeClaimStatus(ready, now);
    expect(s.eligible).toBe(true);
    expect(s.requirements.every((r) => r.met)).toBe(true);
    expect(s.requirements.every((r) => r.detail === null)).toBe(true);
    expect(s.trustPending).toBe(false);
  });

  it("shows Pebble progress below the target and clears it at the target", () => {
    expect(req({ ...ready, earned: 1310 }, "pebbles")).toMatchObject({
      met: false,
      detail: "1,310 so far",
    });
    expect(req({ ...ready, earned: PRIZE_TARGET_PEBBLES - 1 }, "pebbles").met).toBe(false);
    expect(req({ ...ready, earned: PRIZE_TARGET_PEBBLES }, "pebbles").met).toBe(true);
  });

  it("asks a guest to save their account, never to confirm a placeholder address", () => {
    const account = req({ ...ready, isGuest: true, emailVerified: null }, "account");
    expect(account).toMatchObject({ met: false, action: "save-account" });
    expect(account.label).toMatch(/Save your account/);
  });

  it("treats a guest as unconfirmed even if a stamp is somehow present", () => {
    const s = prizeClaimStatus({ ...ready, isGuest: true }, now);
    expect(s.eligible).toBe(false);
    expect(s.requirements.find((r) => r.id === "account")?.met).toBe(false);
  });

  it("asks a saved but unconfirmed spotter to confirm, with the send action", () => {
    const account = req({ ...ready, emailVerified: null }, "account");
    expect(account).toMatchObject({ met: false, action: "verify-email" });
  });

  it("counts separate UTC days the same way the claim gate does", () => {
    const sameDay = [
      new Date("2026-09-01T00:30:00Z"),
      new Date("2026-09-01T23:30:00Z"),
      new Date("2026-09-03T12:00:00Z"),
    ];
    expect(req({ ...ready, answerDates: sameDay }, "days")).toMatchObject({
      met: false,
      detail: `2 of ${PRIZE_MIN_ACTIVE_DAYS} so far`,
    });
  });

  it("reports the span in whole days and says when the count starts", () => {
    const sixDays = [new Date("2026-09-01T10:00:00Z"), new Date("2026-09-07T22:00:00Z")];
    expect(req({ ...ready, answerDates: sixDays }, "span").detail).toBe(
      "Your first and latest spots are 6 days apart so far.",
    );
    const oneDay = [new Date("2026-09-01T10:00:00Z"), new Date("2026-09-02T12:00:00Z")];
    expect(req({ ...ready, answerDates: oneDay }, "span").detail).toBe(
      "Your first and latest spots are 1 day apart so far.",
    );
    expect(req({ ...ready, answerDates: [] }, "span")).toMatchObject({
      met: false,
      detail: "The count starts with your first spot.",
    });
  });

  it("meets the span exactly at the boundary, like the gate (>= not >)", () => {
    const first = new Date("2026-08-20T10:00:00Z");
    const atBoundary = [first, new Date(first.getTime() + PRIZE_MIN_ACTIVITY_SPAN_DAYS * DAY_MS)];
    const justShort = [first, new Date(first.getTime() + PRIZE_MIN_ACTIVITY_SPAN_DAYS * DAY_MS - 1)];
    expect(req({ ...ready, answerDates: atBoundary }, "span").met).toBe(true);
    expect(req({ ...ready, answerDates: justShort }, "span").met).toBe(false);
  });

  it("flags a hidden trust gate only when everything listed is met", () => {
    const lowTrust = { ...ready, trustScore: PRIZE_TRUST_BAR - 1 };
    const s = prizeClaimStatus(lowTrust, now);
    expect(s.requirements.every((r) => r.met)).toBe(true);
    expect(s.eligible).toBe(false);
    expect(s.trustPending).toBe(true);

    const lowTrustAndShort = prizeClaimStatus({ ...lowTrust, earned: 10 }, now);
    expect(lowTrustAndShort.trustPending).toBe(false);
  });

  it("never names the trust score in any requirement", () => {
    const s = prizeClaimStatus({ ...ready, trustScore: 0, emailVerified: null, answerDates: [] }, now);
    const text = s.requirements.map((r) => `${r.label} ${r.detail ?? ""}`).join(" ");
    expect(text).not.toMatch(/trust/i);
  });

  it("agrees with isPrizeEligible on the listed gates across a spread of inputs", () => {
    // If every listed non-Pebble requirement is met and trust is high, the gate
    // must say yes; if any listed one is unmet, it must say no. This is the
    // guarantee that the card cannot promise a claim the route refuses.
    const cases: PrizeClaimInput[] = [
      ready,
      { ...ready, emailVerified: null },
      { ...ready, answerDates: spread.slice(0, 4) },
      { ...ready, answerDates: spread.slice(1) },
      { ...ready, createdAt: new Date(now.getTime() - 3 * DAY_MS), answerDates: [now] },
      { ...ready, answerDates: [] },
    ];
    for (const input of cases) {
      const s = prizeClaimStatus(input, now);
      const listedMet = s.requirements.filter((r) => r.id !== "pebbles").every((r) => r.met);
      const gate = isPrizeEligible(input, now);
      expect(gate.eligible).toBe(listedMet);
      expect(s.eligible).toBe(gate.eligible);
    }
  });
});
