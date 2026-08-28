/**
 * Is a species something OBIS can actually see?
 *
 * The occurrence pull behind `SpeciesProbability` is scoped to two fish classes
 * (`FISH_CLASS_NAMES` in src/lib/biodiversity/obis.ts: Actinopterygii and
 * Chondrichthyes). No invertebrate, seabird or seal is ever requested, so none
 * can ever appear in a bucket's `speciesJson`.
 *
 * That collided badly with `rarityForProbability`, which reads "the bucket has
 * data, and this species is not in it" as a genuinely off-the-charts sighting
 * and returns LEGENDARY (x5). For a crab, jellyfish, starfish, sea snail, squid,
 * urchin, seabird or seal that condition is not a rare event, it is a permanent
 * structural fact of the data source. Measured 28 Aug 2026: the probability
 * cache held 39 distinct species, every one of them a fish, and every
 * invertebrate ID in the game had therefore been paying a x5 legendary
 * multiplier since the rarity layer shipped.
 *
 * The fix is not to touch `rarityForProbability`, whose own contract already
 * says "we do NOT inflate on missing data". It is to stop lying to it: when OBIS
 * structurally cannot see the animal, we have no data, so `bucketHasData` must
 * be false and rarity falls to the neutral x1 unknown case.
 *
 * When the OBIS pull is widened (or an iNaturalist global-rarity fallback lands
 * for the no-data case, the Phase-2 follow-up noted in pebbles.ts), widen
 * OBIS_VISIBLE_SHAPE_CLASSES to match. Keeping the two in step is the whole job
 * of this module.
 */

import { CATALOGUE } from "@/lib/idguide/catalogue";
import type { ShapeClass } from "@/lib/idguide/traits";

/** Catalogue shape classes that fall inside the OBIS fish-only pull. */
export const OBIS_VISIBLE_SHAPE_CLASSES: readonly ShapeClass[] = [
  "fish",
  "flatfish",
] as const;

/**
 * True when a rarity verdict for this species can be trusted, i.e. OBIS would
 * have returned it had it been present. Unknown names return false: if we cannot
 * tell what it is, we cannot claim it is absent from the bucket.
 */
export function obisCanSeeSpecies(scientificName: string | null | undefined): boolean {
  if (!scientificName) return false;
  const entry = CATALOGUE[scientificName];
  if (!entry) return false;
  return OBIS_VISIBLE_SHAPE_CLASSES.includes(entry.shapeClass);
}

/**
 * The `bucketHasData` argument to pass to `rarityForProbability`: the bucket
 * must hold real occurrence data AND the species must be one OBIS looks for.
 */
export function rarityDataAvailable(
  scientificName: string | null | undefined,
  bucketHasData: boolean,
): boolean {
  return bucketHasData && obisCanSeeSpecies(scientificName);
}
