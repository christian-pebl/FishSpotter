/**
 * What a species eats, and what eats it, as the literature states it.
 *
 * This replaced a per-species read of the 72-node farm food web. That graph is
 * a good teaching schematic and a bad answer to "what does this animal eat",
 * because every row it could show had to be another animal already in OUR
 * catalogue. So the cod's diet read "Bib, Velvet swimming crab, Cuttlefish"
 * (three catalogue neighbours) rather than "fish, especially herring, capelin
 * and sandeels", which is what a fisheries scientist would say and what a
 * reader wants. The graph was answering a question about the catalogue while
 * looking like an answer about the animal.
 *
 * So each species now carries a short list of BROAD statements, each read from
 * a published account of that species' diet or predators. Three of each is the
 * target: enough to be representative, few enough that every one can be traced
 * to a passage somebody actually read.
 *
 * `slug` is set only where a bullet's headline prey or predator genuinely is a
 * catalogue species, so the guide can still link one hop through the web where
 * that is honest, and stays plain text where it is not.
 */

import { z } from "zod";
import dietData from "@/data/species-diet.json";

const bulletSchema = z.object({
  /** The statement as the reader sees it, e.g. "Small fish, especially sandeels". */
  text: z.string().min(1),
  /** Catalogue slug, only when this bullet's subject IS a catalogue species. */
  slug: z.string().optional(),
});

const dietSchema = z.record(
  z.string(),
  z.object({
    eats: z.array(bulletSchema).default([]),
    eatenBy: z.array(bulletSchema).default([]),
  }),
);

export type DietBullet = z.infer<typeof bulletSchema>;
export type StatedDiet = { eats: DietBullet[]; eatenBy: DietBullet[] };

export const STATED_DIETS = dietSchema.parse(dietData);

/** The diet statements for a species, or null where none are yet sourced. */
export function getStatedDiet(scientificName: string): StatedDiet | null {
  const d = STATED_DIETS[scientificName];
  if (!d) return null;
  if (d.eats.length === 0 && d.eatenBy.length === 0) return null;
  return d;
}

/** Claim key for one bullet, matching the keys in species-references.json. */
export const dietClaimKey = (side: "eats" | "eatenBy", index: number) => `diet:${side}:${index}`;
