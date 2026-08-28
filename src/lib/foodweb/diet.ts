/**
 * "I eat / eats me" for one species, derived from the farm food web.
 *
 * The food web (`food-web/build-foodweb.mjs`, emitted to
 * `@/data/food-web-links.json` by `npm run build:foodweb-data`) already encodes
 * every feeding link on a seaweed-and-shellfish farm. This reads that graph the
 * other way round: given a species, what does it eat and what eats it.
 *
 * Two things this deliberately does NOT do:
 *   - it does not invent links. If the graph has no predator for a species, the
 *     "eats me" list is empty and the UI says so, rather than implying nothing
 *     eats it. Twelve species genuinely have no predator in the catalogue (the
 *     apex predators, most jellyfish, the big starfish), which is ecologically
 *     fair for a 72-species subset but is not the same as "has no predators".
 *   - it does not assert the links are evidenced. Each is a claim keyed
 *     `edge:<prey>-><predator>` in the reference catalogue, and only some are
 *     bound to a source. The UI shows a citation where one exists and nothing
 *     where it does not.
 */

import { z } from "zod";
import foodWebData from "@/data/food-web-links.json";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { speciesSlug } from "@/lib/species-slug";

/**
 * Validated once at module load, the same contract the trait catalogue uses: a
 * regenerated data file that drifts fails here rather than rendering a broken
 * diet list to a reader.
 */
const foodWebSchema = z.object({
  species: z.array(
    z.object({ name: z.string(), short: z.string(), tier: z.number().int() }),
  ),
  resources: z.record(
    z.string(),
    z.object({ label: z.string(), sub: z.string().nullable() }),
  ),
  edges: z.array(z.tuple([z.string(), z.string()])),
});

const FOOD_WEB = foodWebSchema.parse(foodWebData);
type FoodWebFile = z.infer<typeof foodWebSchema>;

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
  /** What to show. */
  label: string;
  /** Set for a catalogue species, so the UI can link to its guide. */
  scientificName?: string;
  slug?: string;
  /** Set for a non-taxon node (kelp canopy, plankton, the mussel crop). */
  isResource: boolean;
  /** Extra colour for a resource, e.g. "phyto- & zooplankton". */
  detail?: string;
  /** The claim key this link is filed under, for citation lookup. */
  claimKey: string;
  /**
   * Which species entry in the reference catalogue holds this claim. A feeding
   * link is a claim about the PREDATOR's diet, so "eats me" links are filed
   * against the predator, not against the species whose page you are reading.
   */
  claimOwner: string | null;
};

export type SpeciesDiet = {
  /** The food web's own name for this species, or null if it is not in the web. */
  foodWebName: string | null;
  tier: number | null;
  eats: DietItem[];
  eatenBy: DietItem[];
};

const edgeKey = (prey: string, predator: string) => `edge:${prey}->${predator}`;

function toItem(name: string, prey: string, predator: string): DietItem {
  const resource = FOOD_WEB.resources[name];
  const sci = resource ? null : foodWebNameToSci(name);
  const predatorSci = foodWebNameToSci(predator);
  return {
    label: resource ? resource.label : (sci ? CATALOGUE[sci].commonName : name),
    scientificName: sci ?? undefined,
    slug: sci ? speciesSlug(sci) : undefined,
    isResource: Boolean(resource),
    detail: resource?.sub ?? undefined,
    claimKey: edgeKey(prey, predator),
    claimOwner: predatorSci,
  };
}

/** Everything the farm food web says about one species' feeding relationships. */
export function getSpeciesDiet(scientificName: string): SpeciesDiet {
  const foodWebName = FOODWEB_NAME_BY_SCI.get(scientificName) ?? null;
  if (!foodWebName) {
    return { foodWebName: null, tier: null, eats: [], eatenBy: [] };
  }
  const node = FOOD_WEB.species.find((s) => s.name === foodWebName) ?? null;

  const eats: DietItem[] = [];
  const eatenBy: DietItem[] = [];
  for (const [prey, predator] of FOOD_WEB.edges) {
    if (predator === foodWebName) eats.push(toItem(prey, prey, predator));
    if (prey === foodWebName) eatenBy.push(toItem(predator, prey, predator));
  }

  // Real species before resource nodes, then alphabetically: a reader looking
  // for "does it eat crabs" should not have to scan past "plankton" first.
  const order = (a: DietItem, b: DietItem) =>
    Number(a.isResource) - Number(b.isResource) || a.label.localeCompare(b.label);

  return {
    foodWebName,
    tier: node?.tier ?? null,
    eats: eats.sort(order),
    eatenBy: eatenBy.sort(order),
  };
}

/** Trophic tier as a phrase a non-scientist can read. */
export const TIER_LABEL: Record<number, string> = {
  2: "Grazer or filter feeder",
  3: "Planktivore or invertivore",
  4: "Predator",
  5: "Apex predator",
};
