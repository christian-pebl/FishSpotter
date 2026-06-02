import { describe, expect, it } from "vitest";
import { isAcceptedLicense, looksNonPhotographic } from "./wikimedia";

describe("looksNonPhotographic", () => {
  it("rejects historical engravings / plates by title", () => {
    expect(looksNonPhotographic("File:Haeckel_Discomedusae_8.jpg", "https://x/Haeckel_Discomedusae_8.jpg")).toBe(true);
    expect(looksNonPhotographic("File:Hyas araneus - Print - Iconographia Zoologica.tif", "https://x/a.tif")).toBe(true);
    expect(looksNonPhotographic("File:I Cefalopodi viventi (1896) plate.jpg", "https://x/c.jpg")).toBe(true);
  });

  it("rejects non-web raster formats by extension", () => {
    expect(looksNonPhotographic("File:Anything.tif", "https://x/Anything.tif")).toBe(true);
    expect(looksNonPhotographic("File:Diagram.svg", "https://x/Diagram.svg")).toBe(true);
  });

  it("accepts a normal modern photo", () => {
    expect(looksNonPhotographic("File:Necora_puber_Saint-Quay.jpg", "https://x/Necora_puber_Saint-Quay.jpg")).toBe(false);
    expect(looksNonPhotographic("File:Aurelia aurita Luc Viatour.jpg", "https://x/v.jpg")).toBe(false);
  });
});

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
