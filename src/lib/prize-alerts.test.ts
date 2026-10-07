import { describe, expect, it } from "vitest";
import { toPrizeWinnerRow, type PrizeWinnerInput } from "./prize";
import { prizeAlertsDue, stampsAfterAlert, type PrizeAlertStamps } from "./prize-alerts";

const NOW = new Date("2026-10-07T07:30:00Z");
const EARLIER = new Date("2026-10-01T07:30:00Z");

const row = (over: Partial<PrizeWinnerInput> = {}) =>
  toPrizeWinnerRow({
    userId: "u1",
    displayName: "Bunny",
    name: null,
    email: "bunny@example.com",
    isGuest: false,
    emailVerified: new Date("2026-09-18"),
    pebbles: 2309,
    claimedAt: null,
    fulfilledAt: null,
    fulfilledBy: null,
    eligible: false,
    eligibilityReasons: ["activity too bursty (too few distinct days)"],
    ageBand: "18_plus",
    parentEmail: null,
    ...over,
  });

const stamps = (s: Record<string, Partial<PrizeAlertStamps>> = {}) =>
  new Map(
    Object.entries(s).map(([id, v]) => [
      id,
      { prizeAlertedAt: null, prizeSendableAlertedAt: null, ...v },
    ]),
  );

describe("prizeAlertsDue", () => {
  it("tells staff to send to a reachable winner, even one who fails the claim rules", () => {
    const due = prizeAlertsDue([row()], stamps());
    expect(due).toHaveLength(1);
    expect(due[0].kind).toBe("send");
  });

  it("tells staff only once", () => {
    const due = prizeAlertsDue([row()], stamps({ u1: { prizeAlertedAt: EARLIER, prizeSendableAlertedAt: EARLIER } }));
    expect(due).toEqual([]);
  });

  it("flags a guest as waiting, once", () => {
    const guest = row({ isGuest: true, emailVerified: null });
    expect(prizeAlertsDue([guest], stamps())[0].kind).toBe("waiting");
    expect(prizeAlertsDue([guest], stamps({ u1: { prizeAlertedAt: EARLIER } }))).toEqual([]);
  });

  it("tells staff again when a waiting winner becomes reachable", () => {
    const saved = row({ emailVerified: null });
    const due = prizeAlertsDue([saved], stamps({ u1: { prizeAlertedAt: EARLIER } }));
    expect(due.map((a) => a.kind)).toEqual(["send"]);
  });

  it("treats a child without a parent's OK, and an unknown age, as waiting", () => {
    const due = prizeAlertsDue(
      [
        row({ userId: "kid", ageBand: "13_17" }),
        row({ userId: "unknown", ageBand: null }),
      ],
      stamps(),
    );
    expect(due.map((a) => [a.row.userId, a.kind])).toEqual([
      ["kid", "waiting"],
      ["unknown", "waiting"],
    ]);
  });

  it("sends a teenager's prize via the parent who said yes", () => {
    const due = prizeAlertsDue(
      [row({ ageBand: "13_17", parentEmail: "parent@example.com" })],
      stamps(),
    );
    expect(due[0].kind).toBe("send");
    expect(due[0].row.contactEmail).toBe("parent@example.com");
  });

  it("skips claimed rows, which the claim email already covered", () => {
    expect(prizeAlertsDue([row({ claimedAt: EARLIER })], stamps())).toEqual([]);
  });

  it("skips PEBL staff, who can't win", () => {
    const staff = row({ email: "christian@pebl-cic.co.uk" });
    expect(prizeAlertsDue([staff], stamps())).toEqual([]);
  });

  it("still alerts on an unverified address at the staff domain", () => {
    // Domain alone is not staff (src/lib/admin.ts): a guest can type it.
    const typed = row({ email: "christian@pebl-cic.co.uk", emailVerified: null });
    expect(prizeAlertsDue([typed], stamps())).toHaveLength(1);
  });
});

describe("stampsAfterAlert", () => {
  it("stamps both on a send", () => {
    const [a] = prizeAlertsDue([row()], stamps());
    expect(stampsAfterAlert(a, undefined, NOW)).toEqual({
      prizeAlertedAt: NOW,
      prizeSendableAlertedAt: NOW,
    });
  });

  it("keeps the first-alert stamp when a waiting winner becomes sendable", () => {
    const [a] = prizeAlertsDue([row()], stamps({ u1: { prizeAlertedAt: EARLIER } }));
    expect(
      stampsAfterAlert(a, { prizeAlertedAt: EARLIER, prizeSendableAlertedAt: null }, NOW),
    ).toEqual({ prizeAlertedAt: EARLIER, prizeSendableAlertedAt: NOW });
  });

  it("stamps only the first alert for a waiting winner", () => {
    const [a] = prizeAlertsDue([row({ isGuest: true })], stamps());
    expect(stampsAfterAlert(a, undefined, NOW)).toEqual({
      prizeAlertedAt: NOW,
      prizeSendableAlertedAt: null,
    });
  });
});
