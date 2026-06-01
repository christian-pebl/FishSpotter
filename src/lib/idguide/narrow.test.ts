import { describe, expect, it } from "vitest";
import { narrowCandidates } from "./narrow";
import type { SpeciesCatalogue, SpeciesTraits } from "./traits";

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
