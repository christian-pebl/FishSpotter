import { describe, it, expect } from "vitest";
import {
  obisCanSeeSpecies,
  rarityDataAvailable,
  OBIS_VISIBLE_SHAPE_CLASSES,
} from "@/lib/rarity-scope";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { rarityForProbability } from "@/lib/pebbles";

describe("obisCanSeeSpecies", () => {
  it("sees fish and flatfish, which is what the OBIS pull requests", () => {
    expect(obisCanSeeSpecies("Pollachius pollachius")).toBe(true); // fish
    expect(obisCanSeeSpecies("Pleuronectes platessa")).toBe(true); // flatfish
  });

  it("does not see invertebrates", () => {
    // The regression this module exists for: OBIS is scoped to Actinopterygii +
    // Chondrichthyes, so none of these can ever appear in a bucket.
    expect(obisCanSeeSpecies("Aurelia aurita")).toBe(false); // jellyfish
    expect(obisCanSeeSpecies("Necora puber")).toBe(false); // crab
    expect(obisCanSeeSpecies("Asterias rubens")).toBe(false); // starfish
  });

  it("does not see an unknown or missing name", () => {
    expect(obisCanSeeSpecies(null)).toBe(false);
    expect(obisCanSeeSpecies(undefined)).toBe(false);
    expect(obisCanSeeSpecies("")).toBe(false);
    expect(obisCanSeeSpecies("Not a species")).toBe(false);
  });

  it("covers every catalogue species without throwing", () => {
    for (const sci of Object.keys(CATALOGUE)) {
      expect(typeof obisCanSeeSpecies(sci)).toBe("boolean");
    }
  });

  it("agrees with the catalogue's own shape classes", () => {
    for (const [sci, entry] of Object.entries(CATALOGUE)) {
      expect(obisCanSeeSpecies(sci)).toBe(
        OBIS_VISIBLE_SHAPE_CLASSES.includes(entry.shapeClass),
      );
    }
  });
});

describe("rarityDataAvailable", () => {
  it("requires both a populated bucket and a species OBIS looks for", () => {
    expect(rarityDataAvailable("Pollachius pollachius", true)).toBe(true);
    expect(rarityDataAvailable("Pollachius pollachius", false)).toBe(false);
    expect(rarityDataAvailable("Aurelia aurita", true)).toBe(false);
  });

  it("stops an invertebrate grading legendary just for being absent", () => {
    // Before the guard, an invert hit rarityForProbability(null, true) and came
    // back legendary x5 on every single identification.
    const naive = rarityForProbability(null, true);
    expect(naive.tier).toBe("legendary");
    expect(naive.multiplier).toBe(5);

    const guarded = rarityForProbability(
      null,
      rarityDataAvailable("Aurelia aurita", true),
    );
    expect(guarded.tier).toBe("common");
    expect(guarded.multiplier).toBe(1);
  });

  it("still lets a genuinely absent FISH grade legendary", () => {
    const guarded = rarityForProbability(
      null,
      rarityDataAvailable("Pollachius pollachius", true),
    );
    expect(guarded.tier).toBe("legendary");
  });
});
