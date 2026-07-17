import { describe, expect, it } from "vitest";
import { isAdminUser } from "./admin";

// Regression test for the Critical guest->admin escalation finding
// (2026-07-16 audit, Section 3.1): POST /api/guest/claim lets any signed-in
// guest write an arbitrary unclaimed email into User.email with
// emailVerified left null. isAdminUser must require BOTH the domain match
// AND a verified email, or a guest claiming "x@pebl-cic.co.uk" becomes an
// admin with no email ever received or clicked.
describe("isAdminUser", () => {
  it("grants admin for a verified @pebl-cic.co.uk email", () => {
    expect(
      isAdminUser({ email: "staff@pebl-cic.co.uk", emailVerified: new Date() }),
    ).toBe(true);
  });

  it("denies a matching-domain email that is NOT verified (the escalation path)", () => {
    expect(
      isAdminUser({ email: "anything-unclaimed@pebl-cic.co.uk", emailVerified: null }),
    ).toBe(false);
  });

  it("denies a verified email on a different domain", () => {
    expect(
      isAdminUser({ email: "someone@gmail.com", emailVerified: new Date() }),
    ).toBe(false);
  });

  it("denies when both domain and verification fail", () => {
    expect(isAdminUser({ email: "someone@gmail.com", emailVerified: null })).toBe(false);
  });

  it("denies a null/undefined user", () => {
    expect(isAdminUser(null)).toBe(false);
    expect(isAdminUser(undefined)).toBe(false);
  });

  it("denies a user with no email", () => {
    expect(isAdminUser({ email: null, emailVerified: new Date() })).toBe(false);
  });

  it("is case-insensitive on the domain suffix", () => {
    expect(
      isAdminUser({ email: "Staff@PEBL-CIC.CO.UK", emailVerified: new Date() }),
    ).toBe(true);
  });

  it("does not match a lookalike domain (suffix must be exact)", () => {
    expect(
      isAdminUser({ email: "staff@pebl-cic.co.uk.evil.com", emailVerified: new Date() }),
    ).toBe(false);
  });
});
