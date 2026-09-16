import { describe, expect, it } from "vitest";
import { prizeClaimStatus, prizeGate, type PrizeClaimInput } from "./prize-requirements";
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
  ageBand: "18_plus",
  consents: { account: "none", prize: "none" },
  accountConsentGrantedAt: null,
};

/** An under-13 ready in every way, apart from what the case under test changes. */
const child: PrizeClaimInput = {
  ...ready,
  isGuest: true,
  emailVerified: null,
  ageBand: "under_13",
  consents: { account: "granted", prize: "granted" },
  accountConsentGrantedAt: new Date("2026-08-02T00:00:00Z"),
};

/** A 13 to 17 year old with their own confirmed email and a parent's yes. */
const teen: PrizeClaimInput = {
  ...ready,
  ageBand: "13_17",
  consents: { account: "none", prize: "granted" },
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
    // Two different calendar days can still be under 24 hours apart; "0 days"
    // would read as a bug to the spotter.
    const overnight = [new Date("2026-09-01T22:00:00Z"), new Date("2026-09-02T08:00:00Z")];
    expect(req({ ...ready, answerDates: overnight }, "span").detail).toBe(
      "Your first and latest spots are less than a day apart so far.",
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

describe("age and parental consent (16 Sep 2026)", () => {
  const ids = (input: PrizeClaimInput) =>
    prizeClaimStatus(input, now).requirements.map((r) => r.id);

  it("asks for an age first when none is on record, and blocks the claim", () => {
    const unasked = { ...ready, ageBand: null };
    expect(ids(unasked)).toEqual(["pebbles", "age", "account", "days", "span"]);
    expect(req(unasked, "age")).toMatchObject({ met: false, action: "declare-age" });
    const s = prizeClaimStatus(unasked, now);
    expect(s.eligible).toBe(false);
    expect(s.trustPending).toBe(false);
    expect(prizeGate(unasked, now).blocks).toEqual(["age-required"]);
  });

  it("adds the parent requirement for every under-18, and only for them", () => {
    expect(ids(teen)).toEqual(["pebbles", "account", "parent", "days", "span"]);
    expect(ids(child)).toEqual(["pebbles", "account", "parent", "days", "span"]);
    expect(ids(ready)).not.toContain("parent");
  });

  it("lets a teen claim only once a parent has said yes", () => {
    expect(prizeClaimStatus(teen, now).eligible).toBe(true);
    for (const prize of ["none", "pending"] as const) {
      const waiting = { ...teen, consents: { account: "none" as const, prize } };
      expect(prizeClaimStatus(waiting, now).eligible).toBe(false);
      expect(req(waiting, "parent")).toMatchObject({ met: false, action: "ask-parent-prize" });
      expect(prizeGate(waiting, now).blocks).toEqual(["parent-consent"]);
    }
    expect(req({ ...teen, consents: { account: "none", prize: "pending" } }, "parent").detail).toMatch(
      /emailed/,
    );
  });

  it("still needs a teen's own confirmed email", () => {
    const unconfirmed = { ...teen, emailVerified: null };
    expect(req(unconfirmed, "account").action).toBe("verify-email");
    expect(prizeGate(unconfirmed, now).blocks).toEqual(["account"]);
  });

  it("never asks an under-13 for their own email: a parent's account consent stands in", () => {
    expect(prizeClaimStatus(child, now).eligible).toBe(true);
    const account = req(child, "account");
    expect(account.met).toBe(true);
    const noAccount = { ...child, consents: { account: "none" as const, prize: "none" as const } };
    const row = req(noAccount, "account");
    expect(row).toMatchObject({ met: false, action: "ask-parent-account" });
    expect(`${row.label} ${row.detail}`).not.toMatch(/save your account with an email|confirm your email/i);
    expect(prizeGate(noAccount, now).blocks).toEqual(["account", "parent-consent"]);
  });

  it("ignores a stray email stamp on an under-13 account", () => {
    const stamped = {
      ...child,
      isGuest: false,
      emailVerified: new Date("2026-08-01T00:00:00Z"),
      consents: { account: "none" as const, prize: "granted" as const },
    };
    expect(prizeClaimStatus(stamped, now).eligible).toBe(false);
  });

  it("agrees with the gate across child and unknown-age inputs", () => {
    const cases: PrizeClaimInput[] = [
      child,
      teen,
      { ...child, consents: { account: "pending", prize: "granted" } },
      { ...child, consents: { account: "granted", prize: "pending" } },
      { ...child, answerDates: spread.slice(0, 4) },
      { ...teen, consents: { account: "none", prize: "none" } },
      { ...ready, ageBand: null },
      { ...ready, ageBand: "12" },
    ];
    for (const input of cases) {
      const s = prizeClaimStatus(input, now);
      const listedMet = s.requirements.filter((r) => r.id !== "pebbles").every((r) => r.met);
      expect(prizeGate(input, now).eligible).toBe(listedMet);
      expect(s.eligible).toBe(listedMet);
    }
  });
});
