import { decode, encode } from "next-auth/jwt";
import { describe, expect, it } from "vitest";
import {
  GUEST_SESSION_SECONDS,
  MEMBER_SESSION_SECONDS,
  SESSION_COOKIE_SECONDS,
  sessionMaxAgeFor,
} from "./session-lifetime";

const SECRET = "test-secret-for-session-lifetime-only";

describe("sessionMaxAgeFor", () => {
  it("gives a guest the long login and a member the short one", () => {
    expect(sessionMaxAgeFor({ isGuest: true })).toBe(GUEST_SESSION_SECONDS);
    expect(sessionMaxAgeFor({ isGuest: false })).toBe(MEMBER_SESSION_SECONDS);
  });

  it("falls back to the member lifetime when it cannot tell", () => {
    expect(sessionMaxAgeFor({})).toBe(MEMBER_SESSION_SECONDS);
    expect(sessionMaxAgeFor(undefined)).toBe(MEMBER_SESSION_SECONDS);
    expect(sessionMaxAgeFor(null)).toBe(MEMBER_SESSION_SECONDS);
  });

  it("keeps the member login at the seven days it has always been", () => {
    expect(MEMBER_SESSION_SECONDS).toBe(7 * 24 * 60 * 60);
  });

  it("sizes the cookie for the longest token it may carry", () => {
    expect(SESSION_COOKIE_SECONDS).toBe(GUEST_SESSION_SECONDS);
  });
});

describe("token expiry through next-auth's own encode and decode", () => {
  it("stamps each token with its own expiry", async () => {
    const before = Math.floor(Date.now() / 1000);
    const guest = await encode({
      token: { id: "g1", isGuest: true },
      secret: SECRET,
      maxAge: sessionMaxAgeFor({ isGuest: true }),
    });
    const member = await encode({
      token: { id: "m1", isGuest: false },
      secret: SECRET,
      maxAge: sessionMaxAgeFor({ isGuest: false }),
    });

    const g = await decode({ token: guest, secret: SECRET });
    const m = await decode({ token: member, secret: SECRET });
    expect(g?.exp).toBeGreaterThanOrEqual(before + GUEST_SESSION_SECONDS);
    expect(m?.exp).toBeGreaterThanOrEqual(before + MEMBER_SESSION_SECONDS);
    expect(m?.exp).toBeLessThan(before + MEMBER_SESSION_SECONDS + 60);
  });

  it("refuses a member token once its seven days are up, whatever the cookie says", async () => {
    // A token minted with no lifetime left is what a member's cookie carries
    // after seven idle days; decode must refuse it so next-auth signs them out.
    const stale = await encode({ token: { id: "m2", isGuest: false }, secret: SECRET, maxAge: -60 });
    await expect(decode({ token: stale, secret: SECRET })).rejects.toThrow();
  });
});
