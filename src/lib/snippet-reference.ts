/**
 * Retro-judging for the admin reference editor. When a staffer sets (or clears)
 * a clip's reference, every existing answer on that clip must be re-judged
 * against the new reference, and any now-correct answer on a species-level
 * reference unlocks that species in the spotter's pokedex.
 *
 * IMPORTANT (Pebbles invariant): this re-judges the VERDICT (`isCorrect`) and
 * unlocks ONLY — it must never touch `Answer.points`. Since the 18 Jun sea-
 * currency redesign, `points` holds live Pebbles (5–31 at submit, consensus
 * credits up to ~375), and the matcher's 0/1/2 scale is the retired reference
 * model. Writing matcher points here silently slashed real balances and
 * corrupted the leaderboard (2026-07-06 P0, ux-review-round2.md).
 *
 * `rescoreAnswers` is pure (no DB) so it is unit-tested; the server action
 * (admin/snippets/[id]/actions.ts) builds the alias data, calls this, and
 * applies the result in a transaction.
 */
import { matchWithAliases, scientificFromLocalName, type AliasEntry } from "@/lib/answer-matching";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import type { ShapeClass } from "@/lib/idguide/traits";

export type RescoredAnswer = {
  id: string;
  userId: string;
  isCorrect: boolean | null;
  /** the catalogue species this answer's user now collects, or null */
  unlockSpecies: string | null;
};

/**
 * Recompute each answer's verdict against `staffAnswer` (null = community /
 * indeterminate clip -> all pending). A now-correct answer on a reference that
 * resolves to a catalogue species unlocks that species (the reference's
 * species, since isCorrect means the pick matched it). Pebbles (`points`) are
 * deliberately not part of the result — see the module doc.
 */
export function rescoreAnswers(
  answers: Array<{ id: string; userId: string; chosenOption: string }>,
  staffAnswer: string | null,
  aliases: AliasEntry[],
  shapeMap: ReadonlyMap<string, ShapeClass>,
): RescoredAnswer[] {
  const refSci = staffAnswer ? scientificFromLocalName(staffAnswer, aliases) : null;
  const refIsCatalogueSpecies = !!refSci && !!CATALOGUE[refSci];
  return answers.map((a) => {
    const { isCorrect } = matchWithAliases(staffAnswer, a.chosenOption, aliases, shapeMap);
    return {
      id: a.id,
      userId: a.userId,
      isCorrect,
      unlockSpecies: isCorrect === true && refIsCatalogueSpecies ? refSci : null,
    };
  });
}
