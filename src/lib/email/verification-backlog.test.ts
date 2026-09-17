import { describe, expect, it } from "vitest";
import {
  CATCH_UP_COOLDOWN_MS,
  CATCH_UP_SETUP_INTRO,
  CATCH_UP_SETUP_TTL_MS,
  CATCH_UP_VERIFY_INTRO,
  CATCH_UP_VERIFY_TTL_MS,
  decideCatchUp,
  latest,
  planCatchUp,
  type CatchUpTarget,
} from "./verification-backlog";
import { PASSWORD_RESET_TOKEN_TTL_MS } from "@/lib/auth/tokens";

const now = new Date("2026-09-16T12:00:00Z");

const target: CatchUpTarget = {
  id: "u1",
  email: "spotter@example.com",
  displayName: "Sam",
  name: null,
  isGuest: false,
  emailVerified: null,
  hasPassword: false,
  lastLinkAt: null,
  ageNoticeSent: false,
};

describe("planCatchUp", () => {
  it("sends a set-a-password link to an account with no password", () => {
    expect(planCatchUp({ email: "a@example.com", hasPassword: false, lastLinkAt: null }, now)).toEqual({
      kind: "setup",
      ready: true,
    });
  });

  it("sends a verification link to an account that already has a password", () => {
    expect(planCatchUp({ email: "a@example.com", hasPassword: true, lastLinkAt: null }, now).kind).toBe(
      "verify",
    );
  });

  it("sends the admin domain a verification link even with no password, since setting one does not confirm it", () => {
    expect(
      planCatchUp({ email: "staff@pebl-cic.co.uk", hasPassword: false, lastLinkAt: null }, now).kind,
    ).toBe("verify");
  });

  it("holds off while a recent link may still be in the inbox, and is ready again at the cooldown", () => {
    const recent = new Date(now.getTime() - CATCH_UP_COOLDOWN_MS + 1);
    const atCooldown = new Date(now.getTime() - CATCH_UP_COOLDOWN_MS);
    expect(planCatchUp({ email: "a@example.com", hasPassword: true, lastLinkAt: recent }, now).ready).toBe(false);
    expect(planCatchUp({ email: "a@example.com", hasPassword: true, lastLinkAt: atCooldown }, now).ready).toBe(true);
  });
});

describe("decideCatchUp", () => {
  it("sends when the account is real, unconfirmed and not recently mailed", () => {
    expect(decideCatchUp(target, now)).toEqual({ send: true, kind: "setup" });
  });

  it("refuses a missing account, a guest, and an already confirmed one", () => {
    expect(decideCatchUp(null, now)).toMatchObject({ send: false });
    expect(decideCatchUp({ ...target, isGuest: true }, now)).toMatchObject({ send: false });
    expect(decideCatchUp({ ...target, emailVerified: new Date() }, now)).toEqual({
      send: false,
      reason: "already confirmed",
    });
  });

  it("never mails an account told its school address will be removed", () => {
    expect(decideCatchUp({ ...target, ageNoticeSent: true }, now)).toEqual({
      send: false,
      reason: "told this school address will be removed",
    });
  });

  it("refuses inside the cooldown, whatever sent the last link", () => {
    const lastLinkAt = new Date(now.getTime() - 60_000);
    expect(decideCatchUp({ ...target, lastLinkAt }, now)).toEqual({
      send: false,
      reason: "a link went out in the last 24 hours",
    });
  });
});

describe("latest", () => {
  it("picks the newer of two optional dates", () => {
    const a = new Date("2026-09-01");
    const b = new Date("2026-09-02");
    expect(latest(a, b)).toBe(b);
    expect(latest(b, a)).toBe(b);
    expect(latest(undefined, a)).toBe(a);
    expect(latest(a, null)).toBe(a);
    expect(latest(null, undefined)).toBeNull();
  });
});

describe("catch-up copy and lifetimes", () => {
  it("keeps set-a-password links shorter than verification links, and longer than a normal reset", () => {
    expect(CATCH_UP_SETUP_TTL_MS).toBeLessThan(CATCH_UP_VERIFY_TTL_MS);
    expect(CATCH_UP_SETUP_TTL_MS).toBeGreaterThan(PASSWORD_RESET_TOKEN_TTL_MS);
  });

  it("uses no long dashes in anything a spotter reads", () => {
    for (const text of [CATCH_UP_VERIFY_INTRO, CATCH_UP_SETUP_INTRO]) {
      expect(text).not.toMatch(/[\u2013\u2014]/);
    }
  });
});
