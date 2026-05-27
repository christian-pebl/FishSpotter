import { describe, expect, it } from "vitest";
import { isAcceptedLicense } from "./wikimedia";

describe("isAcceptedLicense", () => {
  it("accepts CC0", () => {
    expect(isAcceptedLicense("cc0", undefined)).toBe(true);
    expect(isAcceptedLicense("cc-zero", undefined)).toBe(true);
  });

  it("accepts CC-BY family (any version)", () => {
    expect(isAcceptedLicense("cc-by-2.0", undefined)).toBe(true);
    expect(isAcceptedLicense("cc-by-3.0", undefined)).toBe(true);
    expect(isAcceptedLicense("cc-by-4.0", undefined)).toBe(true);
  });

  it("accepts CC-BY-SA family", () => {
    expect(isAcceptedLicense("cc-by-sa-3.0", undefined)).toBe(true);
    expect(isAcceptedLicense("cc-by-sa-4.0", undefined)).toBe(true);
  });

  it("accepts CC-BY-NC family", () => {
    expect(isAcceptedLicense("cc-by-nc-3.0", undefined)).toBe(true);
    expect(isAcceptedLicense("cc-by-nc-4.0", undefined)).toBe(true);
  });

  it("rejects CC-BY-ND (no derivatives, can't crop for thumbnails)", () => {
    expect(isAcceptedLicense("cc-by-nd-4.0", undefined)).toBe(false);
    expect(isAcceptedLicense("cc-by-nc-nd-4.0", undefined)).toBe(false);
  });

  it("rejects unlicensed / all-rights-reserved", () => {
    expect(isAcceptedLicense(undefined, undefined)).toBe(false);
    expect(isAcceptedLicense("", undefined)).toBe(false);
    expect(isAcceptedLicense("copyrighted", undefined)).toBe(false);
  });

  it("accepts public domain via UsageTerms fallback", () => {
    // Some PD-tagged Wikimedia files don't carry a normalised License slug.
    expect(isAcceptedLicense(undefined, "Public domain")).toBe(true);
    expect(isAcceptedLicense(undefined, "This image is in the public domain")).toBe(true);
    expect(isAcceptedLicense("", "PD-self")).toBe(true);
  });

  it("does NOT accept arbitrary terms that mention 'public' without 'public domain'", () => {
    expect(isAcceptedLicense(undefined, "publicly available, terms apply")).toBe(false);
  });
});
