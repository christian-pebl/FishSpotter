/**
 * Quiz candidate selection (S2-T06, S7-T1).
 *
 * Pure function. Given the OBIS probability set, the snippet's staff
 * answer (which may be null), and a per-species image index, returns a
 * shuffled list of `n` candidates. When a staff answer exists it is
 * always included in the result; when it is null all candidates are
 * drawn from the probability pool. Deterministic: same
 * `(snippetId, n)` always yields the same shuffle.
 *
 * Four fallbacks:
 *   - "OBIS"         — full path, distractors come from OBIS top species
 *   - "CATALOGUE"    — OBIS missing or staff scientific name unresolved;
 *                      distractors come from the species catalogue
 *   - "NO_REFERENCE" — staff answer is null; all candidates drawn from
 *                      OBIS (preferred) or catalogue. No "right answer"
 *                      slot is reserved — every option is a community
 *                      hypothesis (S7-T1)
 *   - "DEGENERATE"   — fewer than 2 photo-having candidates available;
 *                      return what we have so the UI can degrade
 *                      gracefully (S2-T07)
 *
 * The route at /api/snippets/[id]/quiz is the only production caller;
 * tests exercise this module directly without spinning Prisma up.
 */

import { CATALOGUE } from "@/lib/idguide/catalogue";
import type { SpeciesCatalogue } from "@/lib/idguide/traits";
import { hashStringToSeed, mulberry32, shuffle } from "@/lib/shuffle";


export interface QuizCandidate {
  scientificName: string;
  commonName: string;
  thumbUrl: string | null;
  attribution: string | null;
}

export type SelectionFallback =
  | "OBIS"
  | "CATALOGUE"
  | "NO_REFERENCE"
  | "DEGENERATE";

export interface SelectionInput {
  /** OBIS top species for the snippet's bucket. Null = no OBIS row. */
  probability:
    | Array<{ scientificName: string; probability: number }>
    | null;
  /**
   * The snippet's `staffAnswer` field (display label). When null the
   * snippet has no reference identification yet — all candidates are
   * drawn from the probability pool, no "right answer" is reserved.
   */
  staffAnswer: string | null;
  /** Resolved scientific name from SpeciesNameMap. May be null. */
  staffScientific: string | null;
  /** Per-species thumbnail + attribution lookup. */
  imageIndex: Map<string, { thumbUrl: string; attribution: string }>;
  /** Desired candidate count (3-5). Default 4. */
  n?: number;
  /** Seed for deterministic shuffle. Use the snippet id. */
  seed: string;
}

export interface SelectionResult {
  candidates: QuizCandidate[];
  fallback: SelectionFallback;
}

/* --------------------------- helpers --------------------------- */
// PRNG + shuffle live in @/lib/shuffle (S8-T1 — shared with feed-ordering).

function commonNameForScientific(scientific: string): string {
  const entry = CATALOGUE[scientific];
  return entry?.commonName ?? scientific;
}

function makeCandidate(
  scientificName: string,
  commonName: string,
  imageIndex: SelectionInput["imageIndex"],
): QuizCandidate {
  const image = imageIndex.get(scientificName);
  return {
    scientificName,
    commonName,
    thumbUrl: image?.thumbUrl ?? null,
    attribution: image?.attribution ?? null,
  };
}

function hasUsableImage(
  scientific: string,
  imageIndex: SelectionInput["imageIndex"],
): boolean {
  const image = imageIndex.get(scientific);
  return !!image?.thumbUrl;
}

/* --------------------------- main --------------------------- */

export function selectCandidates(input: SelectionInput): SelectionResult {
  const { probability, staffAnswer, staffScientific, imageIndex, seed } = input;
  const n = Math.max(3, Math.min(5, input.n ?? 4));

  const rng = mulberry32(hashStringToSeed(seed));

  /* --------------------- S7-T1: NO_REFERENCE path --------------------- */
  // Snippet has no reference identification yet. Draw all `n` candidates
  // from the probability pool — there's no canonical answer to slot in.
  if (staffAnswer === null) {
    const obisUsable = !!probability && probability.length > 0;
    const pool: Array<{ scientificName: string; weight: number }> = obisUsable
      ? probability!
          .filter((s) => hasUsableImage(s.scientificName, imageIndex))
          .map((s) => ({
            scientificName: s.scientificName,
            weight: s.probability,
          }))
      : Object.keys(CATALOGUE)
          .filter((sci) => hasUsableImage(sci, imageIndex))
          .map((sci) => ({ scientificName: sci, weight: 1 }));

    if (pool.length < 2) {
      // Degenerate even in NO_REFERENCE: < 2 photo-having candidates.
      const fallback: Array<QuizCandidate> = pool.map((p) =>
        makeCandidate(
          p.scientificName,
          commonNameForScientific(p.scientificName),
          imageIndex,
        ),
      );
      return { candidates: fallback, fallback: "DEGENERATE" };
    }

    const picks = weightedSampleWithoutReplacement(pool, n, rng);
    const candidates = picks.map((sci) =>
      makeCandidate(sci, commonNameForScientific(sci), imageIndex),
    );
    return { candidates: shuffle(candidates, rng), fallback: "NO_REFERENCE" };
  }

  /* --------------------- Reference-bearing paths --------------------- */
  // Staff candidate. Scientific name falls back to staffAnswer itself when
  // unresolved so the response shape stays string-typed; the UI displays
  // commonName + thumb so unresolved scientific is invisible to users.
  const staffSci = staffScientific ?? "";
  const staffCandidate = makeCandidate(
    staffSci || staffAnswer,
    staffAnswer,
    imageIndex,
  );

  // Decide which distractor pool to draw from.
  const obisUsable =
    !!probability && probability.length > 0 && staffScientific !== null;

  let pool: Array<{ scientificName: string; weight: number }>;
  let fallback: SelectionFallback;

  if (obisUsable) {
    fallback = "OBIS";
    pool = probability!
      .filter((s) => s.scientificName !== staffScientific)
      .filter((s) => hasUsableImage(s.scientificName, imageIndex))
      .map((s) => ({ scientificName: s.scientificName, weight: s.probability }));
  } else {
    fallback = "CATALOGUE";
    pool = Object.keys(CATALOGUE)
      .filter((sci) => sci !== staffScientific && sci !== staffAnswer)
      .filter((sci) => hasUsableImage(sci, imageIndex))
      .map((sci) => ({ scientificName: sci, weight: 1 }));
  }

  // Degenerate: fewer than 2 photo-having distractors. Return only the
  // staff candidate so the UI can show a "no comparable candidates"
  // message + free-text fallback (S2-T07).
  if (pool.length < 2) {
    return { candidates: [staffCandidate], fallback: "DEGENERATE" };
  }

  const distractors = weightedSampleWithoutReplacement(pool, n - 1, rng);
  const distractorCandidates = distractors.map((sci) =>
    makeCandidate(sci, commonNameForScientific(sci), imageIndex),
  );

  const all = shuffle([staffCandidate, ...distractorCandidates], rng);
  return { candidates: all, fallback };
}

/**
 * Weighted sampling without replacement. For each pick, compute the
 * total weight, pick a target, walk the pool. Cheap with O(n) species.
 */
function weightedSampleWithoutReplacement(
  pool: Array<{ scientificName: string; weight: number }>,
  count: number,
  rng: () => number,
): string[] {
  const wanted = Math.min(count, pool.length);
  const picks: string[] = [];
  const remaining = pool.slice();
  for (let i = 0; i < wanted; i++) {
    const totalWeight = remaining.reduce((acc, p) => acc + p.weight, 0);
    if (totalWeight <= 0) break;
    const target = rng() * totalWeight;
    let cumulative = 0;
    let pickedIndex = remaining.length - 1;
    for (let j = 0; j < remaining.length; j++) {
      cumulative += remaining[j].weight;
      if (cumulative >= target) {
        pickedIndex = j;
        break;
      }
    }
    picks.push(remaining[pickedIndex].scientificName);
    remaining.splice(pickedIndex, 1);
  }
  return picks;
}
