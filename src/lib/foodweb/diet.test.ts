import { describe, expect, it } from "vitest";
import foodWebData from "@/data/food-web-links.json";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { REFERENCES } from "@/lib/references/catalogue";
import { STATED_DIETS } from "@/lib/foodweb/stated-diet";
import { speciesSlug } from "@/lib/species-slug";
import { getSpeciesDiet } from "./diet";

/**
 * The diet section is the part of the guide most likely to drift back into
 * describing our own catalogue instead of the animal, so the tests here are
 * mostly about WHERE a statement came from rather than about the code path.
 */
describe("getSpeciesDiet", () => {
  it("reads its bullets from the stated-diet file, not from the food-web graph", () => {
    for (const sci of Object.keys(CATALOGUE)) {
      const d = getSpeciesDiet(sci);
      const stated = STATED_DIETS[sci];
      expect(d.eats.map((i) => i.label)).toEqual((stated?.eats ?? []).map((b) => b.text));
      expect(d.eatenBy.map((i) => i.label)).toEqual((stated?.eatenBy ?? []).map((b) => b.text));
    }
  });

  it("keeps the authored order, because the bullets are written most-representative first", () => {
    const withThree = Object.entries(STATED_DIETS).find(([, d]) => d.eats.length >= 2);
    if (!withThree) return;
    const [sci, stated] = withThree;
    expect(getSpeciesDiet(sci).eats[0].label).toBe(stated.eats[0].text);
  });

  it("files each bullet under an indexed claim key", () => {
    for (const sci of Object.keys(CATALOGUE)) {
      const d = getSpeciesDiet(sci);
      d.eats.forEach((item, i) => expect(item.claimKey).toBe(`diet:eats:${i}`));
      d.eatenBy.forEach((item, i) => expect(item.claimKey).toBe(`diet:eatenBy:${i}`));
    }
  });

  it("every published bullet is bound to a passage somebody read", () => {
    // The page carries no disclaimer about which statements are sourced, so
    // this is the only thing standing behind that promise: a bullet that
    // reaches a reader without an evidenced claim is a silent lie.
    const unevidenced: string[] = [];
    for (const sci of Object.keys(CATALOGUE)) {
      const d = getSpeciesDiet(sci);
      for (const item of [...d.eats, ...d.eatenBy]) {
        const claim = REFERENCES.species[sci]?.claims?.[item.claimKey];
        if (!claim?.claimSupported) unevidenced.push(`${sci} ${item.claimKey}`);
      }
    }
    expect(unevidenced).toEqual([]);
  });

  it("only links a bullet to a species the catalogue actually holds", () => {
    // A bullet's slug turns it into a link. A link to a slug that resolves to
    // nothing is a 404 handed to a reader who trusted the citation beside it.
    const known = new Set(Object.keys(CATALOGUE).map(speciesSlug));
    for (const sci of Object.keys(CATALOGUE)) {
      const d = getSpeciesDiet(sci);
      for (const item of [...d.eats, ...d.eatenBy]) {
        if (!item.slug) continue;
        expect(known.has(item.slug), `${sci} ${item.claimKey} links to unknown slug ${item.slug}`).toBe(true);
      }
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
