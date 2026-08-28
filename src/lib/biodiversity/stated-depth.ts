/**
 * The depth a published source STATES for a species, not one we computed.
 *
 * This replaced a figure derived from OBIS occurrence records. That figure was
 * wrong in a way that mattered: OBIS's `depth` is the midpoint of a sampling
 * interval rather than an observation of the animal, only some records carry
 * one and not at random, and for an air-breather it is the depth of the
 * OBSERVER. Two live pages were telling the public that a grey seal and a great
 * cormorant are "usually seen at ~0 m". The seal's real figure, from the SCOS
 * report, is that it forages mainly to 100 m.
 *
 * So the tile now shows what a source says, carries a citation like every other
 * fact on the page, and is simply ABSENT for the 10 species where no source
 * states a range. An absent tile is better than a computed one: the six
 * jellyfish and the two birds are among the missing, and each of those is a
 * case where a number would have been actively misleading.
 *
 * Regenerate with `npm run refs:apply-depth`.
 */

import { z } from "zod";
import statedDepthData from "@/data/species-depth.json";

const statedDepthSchema = z.record(
  z.string(),
  z.object({
    /** What the tile shows, e.g. "40-100 m", "Intertidal to 60 m". */
    label: z.string().min(1),
    /** The fuller range when the source gives both, e.g. "0-600 m (usually 150-200 m)". */
    detail: z.string().optional(),
    /** The source that states it, for the citation marker. */
    sourceId: z.string().min(1),
  }),
);

export const STATED_DEPTHS = statedDepthSchema.parse(statedDepthData);

export type StatedDepth = { label: string; detail?: string; sourceId: string };

/** The stated depth range for a species, or null if no source gives one. */
export function getStatedDepth(scientificName: string): StatedDepth | null {
  return STATED_DEPTHS[scientificName] ?? null;
}
