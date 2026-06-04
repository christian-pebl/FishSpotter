/**
 * PEBL internal species IDs — the authoritative reference label PEBL assigns to
 * a species, shown in the reveal card's "PEBL ID" panel (RevealResult.tsx).
 *
 * HOOK (4 Jun 2026): until the raw IDs are supplied, this map is empty and the
 * panel falls back to the snippet's `staffAnswer` (the existing reference
 * string). When the raw IDs arrive, add one entry per species keyed by the
 * NORMALISED staffAnswer (lowercase / trimmed, via normalizeAnswer) mapping to
 * the PEBL ID string to display. Example:
 *
 *   export const PEBL_IDS: Record<string, string> = {
 *     "cuckoo wrasse": "PEBL-FISH-014",
 *     "ballan wrasse": "PEBL-FISH-011",
 *   };
 *
 * Keying on the reference label (not the snippet id) means every clip of the
 * same species shows the same PEBL ID, even when the clip's coarse reference is
 * just "Fish".
 */
import { normalizeAnswer } from "@/lib/normalize-answer";

export const PEBL_IDS: Record<string, string> = {
  // Populated once Christian supplies the raw IDs.
};

/**
 * Resolve the PEBL ID to display for a given reference label. Returns the
 * mapped ID when one exists, else the reference string as-is, else null when
 * the snippet has no reference yet.
 */
export function resolvePeblId(staffAnswer: string | null | undefined): string | null {
  if (!staffAnswer) return null;
  return PEBL_IDS[normalizeAnswer(staffAnswer)] ?? staffAnswer;
}
