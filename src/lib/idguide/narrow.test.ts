import { describe, expect, it } from "vitest";
import { narrowCandidates } from "./narrow";
import type { SpeciesCatalogue, SpeciesTraits } from "./traits";
import speciesTraitsData from "@/data/species-traits.json";

const REAL_CATALOGUE = speciesTraitsData as unknown as SpeciesCatalogue;

function sp(over: Partial<SpeciesTraits>): SpeciesTraits {
  return {
    commonName: "x",
    shapeClass: "fish",
    bodyShape: ["fusiform"],
    size: "medium",
    coloration: ["uniform"],
    markings: ["none"],
    finShape: ["forked-tail"],
    features: ["none"],
    behavior: ["solitary"],
    habitat: ["open-water"],
    movement: ["water-column"],
    fieldNote: "",
    ...over,
  };
}

describe("narrowCandidates — shapeClass hard filter", () => {
  const catalogue: SpeciesCatalogue = {
    "Fish one": sp({ commonName: "Fish one", shapeClass: "fish", bodyShape: ["fusiform"] }),
    "Fish two": sp({ commonName: "Fish two", shapeClass: "fish", bodyShape: ["eel-like"] }),
    "Crab one": sp({ commonName: "Crab one", shapeClass: "crab", bodyShape: ["fusiform"] }),
  };

  it("returns every class when shapeClass is unset", () => {
    expect(narrowCandidates({ catalogue }).length).toBe(3);
  });

  it("excludes off-class species when shapeClass is set", () => {
    const res = narrowCandidates({ catalogue, shapeClass: "crab" });
    expect(res.map((c) => c.commonName)).toEqual(["Crab one"]);
  });

  it("excludes a trait-matching fish when the gate is crab (hard filter, not a down-weight)", () => {
    // Fish one and Crab one both match bodyShape:fusiform, but the crab gate
    // removes the fish before scoring.
    const res = narrowCandidates({
      catalogue,
      shapeClass: "crab",
      mustHave: { bodyShape: ["fusiform"] },
    });
    expect(res.map((c) => c.commonName)).toEqual(["Crab one"]);
  });

  it("returns nothing when the gated class has no species", () => {
    expect(narrowCandidates({ catalogue, shapeClass: "jellyfish" })).toEqual([]);
  });
});

describe("narrowCandidates — movement scored as a normal trait", () => {
  const catalogue: SpeciesCatalogue = {
    "Hover fish": sp({ commonName: "Hover fish", movement: ["water-column"] }),
    "Bottom fish": sp({ commonName: "Bottom fish", movement: ["stationary", "fits-and-starts"] }),
  };

  it("keeps a species whose movement overlaps the request and drops one that does not", () => {
    const res = narrowCandidates({ catalogue, mustHave: { movement: ["stationary"] } });
    expect(res.map((c) => c.commonName)).toEqual(["Bottom fish"]);
  });

  it("excludes via mustNotHave movement", () => {
    const res = narrowCandidates({ catalogue, mustNotHave: { movement: ["water-column"] } });
    expect(res.map((c) => c.commonName)).toEqual(["Bottom fish"]);
  });
});

describe("narrowCandidates — crab vocabulary (carapaceTexture / crabFeatures)", () => {
  const catalogue: SpeciesCatalogue = {
    Swimmer: sp({
      commonName: "Swimmer",
      shapeClass: "crab",
      carapaceTexture: ["furry"],
      crabFeatures: ["swimming-paddle", "red-eyes"],
    }),
    Walker: sp({
      commonName: "Walker",
      shapeClass: "crab",
      carapaceTexture: ["pie-crust"],
      crabFeatures: ["dark-claw-tips"],
    }),
  };

  it("keeps only the crab carrying the requested crabFeature", () => {
    const res = narrowCandidates({
      catalogue,
      shapeClass: "crab",
      mustHave: { crabFeatures: ["swimming-paddle"] },
    });
    expect(res.map((c) => c.commonName)).toEqual(["Swimmer"]);
  });

  it("scores carapaceTexture as a normal trait", () => {
    const res = narrowCandidates({
      catalogue,
      shapeClass: "crab",
      mustHave: { carapaceTexture: ["pie-crust"] },
    });
    expect(res.map((c) => c.commonName)).toEqual(["Walker"]);
  });

  it("a fish never carries crab traits, so the crab vocab can't surface a fish", () => {
    const fishVal = sp({ commonName: "Plain fish", shapeClass: "fish" });
    expect(fishVal.carapaceTexture).toBeUndefined();
    expect(fishVal.crabFeatures).toBeUndefined();
  });
});

describe("narrowCandidates — real catalogue crab branch", () => {
  it("the crab gate lands on at least the seeded subtidal six", () => {
    const res = narrowCandidates({ catalogue: REAL_CATALOGUE, shapeClass: "crab", limit: 50 });
    expect(res.length).toBeGreaterThanOrEqual(6);
    expect(res.every((c) => REAL_CATALOGUE[c.scientificName].shapeClass === "crab")).toBe(true);
  });

  it("swimming-paddle narrows the crab gate to the two swimming crabs", () => {
    const res = narrowCandidates({
      catalogue: REAL_CATALOGUE,
      shapeClass: "crab",
      mustHave: { crabFeatures: ["swimming-paddle"] },
      limit: 50,
    });
    expect(res.map((c) => c.commonName).sort()).toEqual(["Harbour Crab", "Velvet Swimming Crab"]);
  });
});
