/**
 * The four fact tiles on a species guide, as published sources state them.
 *
 * These used to be rendered from the Spot It wizard's trait tokens, and that
 * was the wrong source for them. Those tokens exist to CUT a candidate list:
 * `size` has exactly three values, `habitat` and `behavior` a short controlled
 * vocabulary, all chosen because a beginner can judge them off a short clip.
 * They are good questions and bad facts. Rendering them as statements produced
 * a corkwing wrasse that was "Small (under 10 cm)" when MarLIN says it reaches
 * 25 cm, and a thick-lipped mullet whose habitat read "Near surface, Sandy
 * bottom" against a source calling it demersal and catadromous. Neither was a
 * data-entry error; the vocabulary simply could not say what the source said.
 *
 * So the guide now shows a short phrase per fact, written from the source's own
 * account and bound to the passage it came from. The wizard keeps its tokens in
 * `species-traits.json`, untouched: the two are answering different questions
 * and no longer have to agree.
 *
 * A fact with no entry here is not rendered. There is deliberately no default.
 */

import { z } from "zod";
import factsData from "@/data/species-facts.json";

const factSchema = z.object({
  /** The phrase the reader sees. Short: this is a tile, not a paragraph. */
  text: z.string().min(1).max(160),
});

const speciesFactsSchema = z.record(
  z.string(),
  z.object({
    depth: factSchema.optional(),
    size: factSchema.optional(),
    habitat: factSchema.optional(),
    behaviour: factSchema.optional(),
  }),
);

export type SpeciesFactKey = "depth" | "size" | "habitat" | "behaviour";
export type SpeciesFacts = z.infer<typeof speciesFactsSchema>[string];

export const SPECIES_FACTS = speciesFactsSchema.parse(factsData);

/** The tiles for one species, or null where none are yet sourced. */
export function getSpeciesFacts(scientificName: string): SpeciesFacts | null {
  return SPECIES_FACTS[scientificName] ?? null;
}

/**
 * Claim key for a fact tile.
 *
 * Kept on the historic `trait:` prefix, and on the American `behavior`
 * spelling, so the passages already read for these tiles stay attached to them.
 * The key is an identifier; the tile it now renders is what changed.
 */
export const factClaimKey = (fact: SpeciesFactKey) =>
  `trait:${fact === "behaviour" ? "behavior" : fact}`;
