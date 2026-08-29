/**
 * "I eat / eats me" for one species.
 *
 * These lists used to be read off the 72-node farm food web: given a species,
 * which edges point at it. That made the section a statement about our own
 * catalogue rather than about the animal. Every row it could show had to be
 * another species we happen to carry, so the cod's diet read "Bib, Velvet
 * swimming crab, Common cuttlefish" (three catalogue neighbours) instead of
 * "fish, especially herring, capelin and sandeels", which is what the
 * literature says and what a reader came for. Twelve species had an empty
 * "eats me" column that needed a paragraph of explanation for why that did not
 * mean nothing ate them.
 *
 * So the lists now come from `src/data/species-diet.json`: a few broad
 * statements per species, each authored from a published account of that
 * animal's diet or predators and each bound to the passage it was read from.
 * The trophic tier still comes from the food web, because a tier IS a property
 * of the diagram and is cited as such.
 *
 * `slug` is set on a bullet only where its subject genuinely is a catalogue
 * species and the source names it, so the guide keeps the "walk the web one
 * hop" link exactly where that is honest and drops it everywhere else.
 */

import { z } from "zod";
import foodWebData from "@/data/food-web-links.json";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { dietClaimKey, getStatedDiet } from "@/lib/foodweb/stated-diet";

/**
 * Validated once at module load, the same contract the trait catalogue uses: a
 * regenerated data file that drifts fails here rather than rendering a broken
 * tier to a reader.
 */
const foodWebSchema = z.object({
  species: z.array(z.object({ name: z.string(), short: z.string(), tier: z.number().int() })),
  resources: z.record(z.string(), z.object({ label: z.string(), sub: z.string().nullable() })),
  edges: z.array(z.tuple([z.string(), z.string()])),
});

const FOOD_WEB = foodWebSchema.parse(foodWebData);

/** Food-web display name -> catalogue scientific name. */
const SCI_BY_FOODWEB_NAME = new Map<string, string>();
for (const [sci, traits] of Object.entries(CATALOGUE)) {
  SCI_BY_FOODWEB_NAME.set(traits.commonName.toLowerCase(), sci);
}
const foodWebNameToSci = (name: string) => SCI_BY_FOODWEB_NAME.get(name.toLowerCase()) ?? null;

/** Catalogue scientific name -> the name the food web uses for it. */
const FOODWEB_NAME_BY_SCI = new Map<string, string>();
for (const s of FOOD_WEB.species) {
  const sci = foodWebNameToSci(s.name);
  if (sci) FOODWEB_NAME_BY_SCI.set(sci, s.name);
}

export type DietItem = {
  /** The statement as the reader sees it. */
  label: string;
  /** Set only when the bullet's subject is a catalogue species we can link to. */
  slug?: string;
  /** The claim key this bullet is filed under, for citation lookup. */
  claimKey: string;
};

export type SpeciesDiet = {
  /** The food web's own name for this species, or null if it is not in the web. */
  foodWebName: string | null;
  tier: number | null;
  eats: DietItem[];
  eatenBy: DietItem[];
};

/** What a species eats and what eats it, as published sources state it. */
export function getSpeciesDiet(scientificName: string): SpeciesDiet {
  const foodWebName = FOODWEB_NAME_BY_SCI.get(scientificName) ?? null;
  const node = foodWebName ? (FOOD_WEB.species.find((s) => s.name === foodWebName) ?? null) : null;
  const stated = getStatedDiet(scientificName);

  // Authored order is meaningful: the bullets are written most-representative
  // first, so they are NOT re-sorted here.
  const toItems = (side: "eats" | "eatenBy"): DietItem[] =>
    (stated?.[side] ?? []).map((b, i) => ({
      label: b.text,
      slug: b.slug,
      claimKey: dietClaimKey(side, i),
    }));

  return {
    foodWebName,
    tier: node?.tier ?? null,
    eats: toItems("eats"),
    eatenBy: toItems("eatenBy"),
  };
}

/** Trophic tier as a phrase a non-scientist can read. */
export const TIER_LABEL: Record<number, string> = {
  2: "Grazer or filter feeder",
  3: "Planktivore or invertivore",
  4: "Predator",
  5: "Apex predator",
};
