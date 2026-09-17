import { describe, expect, it } from "vitest";
import {
  CONSENT_REQUEST_TTL_MS,
  isConsentPurpose,
  isRequestLive,
  maskEmail,
  normaliseParentEmail,
  purposeAllowedFor,
  summariseConsents,
} from "./parental-consent";

const now = new Date("2026-09-16T12:00:00Z");

describe("purposeAllowedFor", () => {
  it("keeps account consents for under-13s only", () => {
    expect(purposeAllowedFor("account", "under_13")).toBe(true);
    for (const band of ["13_17", "18_plus", null, "unknown"]) {
      expect(purposeAllowedFor("account", band)).toBe(false);
    }
  });

  it("offers a prize consent to every under-18, and nobody else", () => {
    expect(purposeAllowedFor("prize", "under_13")).toBe(true);
    expect(purposeAllowedFor("prize", "13_17")).toBe(true);
    for (const band of ["18_plus", null, "unknown"]) {
      expect(purposeAllowedFor("prize", band)).toBe(false);
    }
  });
});

describe("summariseConsents", () => {
  it("reports none when there is nothing", () => {
    expect(summariseConsents([])).toEqual({ account: "none", prize: "none" });
  });

  it("lets a grant win over a pending row for the same purpose", () => {
    expect(
      summariseConsents([
        { purpose: "prize", status: "granted" },
        { purpose: "prize", status: "pending" },
      ]),
    ).toEqual({ account: "none", prize: "granted" });
    expect(
      summariseConsents([
        { purpose: "account", status: "pending" },
        { purpose: "account", status: "granted" },
      ]).account,
    ).toBe("granted");
  });

  it("ignores rows it does not recognise", () => {
    expect(
      summariseConsents([
        { purpose: "newsletter", status: "granted" },
        { purpose: "prize", status: "revoked" },
      ]),
    ).toEqual({ account: "none", prize: "none" });
    expect(isConsentPurpose("newsletter")).toBe(false);
  });
});

describe("isRequestLive", () => {
  it("counts a pending request only until its link expires", () => {
    const fresh = new Date(now.getTime() + CONSENT_REQUEST_TTL_MS);
    expect(isRequestLive({ status: "pending", requestExpiresAt: fresh }, now)).toBe(true);
    expect(isRequestLive({ status: "pending", requestExpiresAt: now }, now)).toBe(false);
    expect(isRequestLive({ status: "pending", requestExpiresAt: null }, now)).toBe(false);
    expect(isRequestLive({ status: "granted", requestExpiresAt: fresh }, now)).toBe(false);
  });
});

describe("addresses", () => {
  it("normalises before storing or comparing", () => {
    expect(normaliseParentEmail("  Mum@Example.COM ")).toBe("mum@example.com");
  });

  it("masks an address for staff screens", () => {
    expect(maskEmail("jane.doe@example.com")).toBe("j***@example.com");
    expect(maskEmail("bad")).toBe("***");
    expect(maskEmail("@example.com")).toBe("***");
  });
});
