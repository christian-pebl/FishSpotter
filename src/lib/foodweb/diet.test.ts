import { describe, expect, it } from "vitest";
import foodWebData from "@/data/food-web-links.json";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { getSpeciesDiet, TIER_LABEL } from "./diet";

/**
 * The diet section is derived data, so the risk is not a crash: it is a
 * plausible-looking list that is subtly the wrong way round, or that silently
 * drops the species whose names differ between the food web and the catalogue.
 */
describe("getSpeciesDiet", () => {
  it("places every food-web species onto a catalogue entry", () => {
    // A name drift between the two files would silently empty a diet section,
    // which looks like "this animal eats nothing" rather than like a bug.
    const missing = Object.keys(CATALOGUE).filter((sci) => {
      const d = getSpeciesDiet(sci);
      return d.foodWebName === null;
    });
    expect(missing).toEqual([]);
  });

  it("reads the graph in the right direction", () => {
    const cod = getSpeciesDiet("Gadus morhua");
    // Cod eats sprat and is eaten by grey seal, not the other way round.
    expect(cod.eats.map((i) => i.label)).toContain("Sprat");
    expect(cod.eatenBy.map((i) => i.label)).toContain("Grey seal");
    expect(cod.eats.map((i) => i.label)).not.toContain("Grey seal");
  });

  it("files each link under a claim key owned by the predator", () => {
    const cod = getSpeciesDiet("Gadus morhua");
    const sprat = cod.eats.find((i) => i.label === "Sprat");
    expect(sprat?.claimKey).toBe("edge:Sprat->Atlantic cod");
    expect(sprat?.claimOwner).toBe("Gadus morhua");

    // On the "eaten by" side the claim belongs to the PREDATOR, since it is a
    // statement about the seal's diet, not the cod's.
    const seal = cod.eatenBy.find((i) => i.label === "Grey seal");
    expect(seal?.claimKey).toBe("edge:Atlantic cod->Grey seal");
    expect(seal?.claimOwner).toBe("Halichoerus grypus");
  });

  it("links catalogue species and flags non-taxon resources", () => {
    const limpet = getSpeciesDiet("Patella vulgata");
    const kelp = limpet.eats.find((i) => i.isResource);
    expect(kelp?.label).toBe("Kelp / seaweed");
    expect(kelp?.slug).toBeUndefined();

    const cod = getSpeciesDiet("Gadus morhua");
    const sprat = cod.eats.find((i) => i.label === "Sprat");
    expect(sprat?.isResource).toBe(false);
    expect(sprat?.slug).toBe("sprattus-sprattus");
  });

  it("sorts real species above resource nodes", () => {
    const cod = getSpeciesDiet("Gadus morhua");
    const firstResource = cod.eats.findIndex((i) => i.isResource);
    const lastSpecies = cod.eats.map((i) => i.isResource).lastIndexOf(false);
    if (firstResource >= 0) expect(firstResource).toBeGreaterThan(lastSpecies);
  });

  it("returns an empty predator list for an apex predator rather than inventing one", () => {
    const seal = getSpeciesDiet("Halichoerus grypus");
    expect(seal.eats.length).toBeGreaterThan(0);
    expect(seal.eatenBy).toEqual([]);
    expect(seal.tier).toBe(5);
  });

  it("gives every placed species a tier with a readable label", () => {
    for (const sci of Object.keys(CATALOGUE)) {
      const d = getSpeciesDiet(sci);
      expect(d.tier).not.toBeNull();
      expect(TIER_LABEL[d.tier as number]).toBeTruthy();
    }
  });

  it("carries no farm-role classification at all", () => {
    // Withdrawn 28 Aug 2026. The food web used to label each species
    // created / enhanced / harmed / anyway by the farm, and drive a
    // with-and-without-farm toggle from it. Checked against the published
    // literature, not one of the 21 "created" assignments held up: 10 were
    // contradicted by the source found for them, 9 were unconfirmed and 2 had
    // no source at all.
    //
    // This test exists so the field cannot come back by accident. Reinstating
    // it means binding a `farm:role` claim to a passage that actually says the
    // farm creates or enhances that species, and getting it past refs:verify.
    for (const sci of Object.keys(CATALOGUE)) {
      expect(getSpeciesDiet(sci)).not.toHaveProperty("farmRole");
    }
    const raw = JSON.stringify(foodWebData);
    expect(raw).not.toContain("farmRole");
    expect(raw).not.toContain("created");
  });
});
