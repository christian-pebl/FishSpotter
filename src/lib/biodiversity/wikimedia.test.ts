import { describe, expect, it } from "vitest";
import { isAcceptedLicense, looksNonPhotographic, titleNamesACongener } from "./wikimedia";

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

describe("titleNamesACongener", () => {
  it("refuses a file whose title names a different species in the same genus", () => {
    // The case that shipped: an exact-phrase Commons search for the sand smelt
    // returned the big-scale sand smelt, because the file's DESCRIPTION
    // mentions the species we asked for.
    expect(
      titleNamesACongener("File:Atherina boyeri Sardinia.jpg", "Atherina presbyter"),
    ).toBe(true);
  });

  it("allows the species we actually asked for", () => {
    expect(
      titleNamesACongener("File:Atherina presbyter 103372383.jpg", "Atherina presbyter"),
    ).toBe(false);
  });

  it("handles the underscores Commons uses for spaces", () => {
    expect(titleNamesACongener("File:Pollachius_virens_shoal.jpg", "Pollachius pollachius")).toBe(true);
    expect(titleNamesACongener("File:Pollachius_pollachius_1.jpg", "Pollachius pollachius")).toBe(false);
  });

  it("leaves a title naming an unrelated genus alone", () => {
    // Not our business: a wrong-subject modern photo is the vision check's
    // job. This guard only rules on same-genus identity claims.
    expect(titleNamesACongener("File:Gadus morhua Bergen.jpg", "Atherina presbyter")).toBe(false);
  });

  it("does not read a common-name title as a binomial", () => {
    // "Sand smelt" matches the Genus-species shape. Requiring the genus to
    // match the target is what stops every honest file being thrown away.
    expect(titleNamesACongener("File:Sand smelt shoal Cornwall.jpg", "Atherina presbyter")).toBe(false);
  });

  it("is untroubled by a missing title", () => {
    expect(titleNamesACongener(undefined, "Atherina presbyter")).toBe(false);
  });
});

describe("titleNamesACongener: the four real Commons titles it was tuned on", () => {
  // One impostor and three honest files, all four of which the first,
  // genus-match-only version of this guard refused.
  it("refuses the impostor", () => {
    expect(titleNamesACongener("File:Atherina boyeri Sardinia.jpg", "Atherina presbyter")).toBe(true);
  });

  it("keeps a common name that happens to start with the genus", () => {
    expect(titleNamesACongener("File:Conger eel01.jpg", "Conger conger")).toBe(false);
  });

  it("keeps a file captioned in another language before the binomial", () => {
    expect(
      titleNamesACongener(
        "File:Sepia comun (Sepia officinalis), Parque natural de la Arrabida, Portugal.jpg",
        "Sepia officinalis",
      ),
    ).toBe(false);
  });

  it("keeps an orthographic variant of the same epithet", () => {
    expect(
      titleNamesACongener("File:Loligo forbesi, gefangen im Geirangerfjord.jpg", "Loligo forbesii"),
    ).toBe(false);
  });

  it("still refuses a genuinely different congener", () => {
    expect(titleNamesACongener("File:Pollachius_virens_shoal.jpg", "Pollachius pollachius")).toBe(true);
  });
});
