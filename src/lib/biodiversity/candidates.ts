/**
 * Quiz candidate selection (S2-T06).
 *
 * Pure function. Given the OBIS probability set, the snippet's staff
 * answer, and a per-species image index, returns a shuffled list of
 * `n` candidates including the staff answer. Deterministic: same
 * `(snippetId, n)` always yields the same shuffle.
 *
 * Three fallbacks:
 *   - "OBIS"       — full path, distractors come from OBIS top species
 *   - "CATALOGUE"  — OBIS missing or staff scientific name unresolved;
 *                    distractors come from the 26-species catalogue
 *   - "DEGENERATE" — fewer than 2 photo-having distractors available;
 *                    return just the staff candidate so the UI can
 *                    degrade gracefully (S2-T07)
 *
 * The route at /api/snippets/[id]/quiz is the only production caller;
 * tests exercise this module directly without spinning Prisma up.
 */

import speciesTraitsData from "@/data/species-traits.json";
import type { SpeciesCatalogue } from "@/lib/idguide/traits";

const CATALOGUE = speciesTraitsData as unknown as SpeciesCatalogue;

export interface QuizCandidate {
  scientificName: string;
  commonName: string;
  thumbUrl: string | null;
  attribution: string | null;
}

export type SelectionFallback = "OBIS" | "CATALOGUE" | "DEGENERATE";

export interface SelectionInput {
  /** OBIS top species for the snippet's bucket. Null = no OBIS row. */
  probability:
    | Array<{ scientificName: string; probability: number }>
    | null;
  /** The snippet's `staffAnswer` field (display label). */
  staffAnswer: string;
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

/* --------------------------- deterministic PRNG --------------------------- */

function hashStringToSeed(s: string): number {
  // Adapted FNV-1a — stable across Node and modern browsers.
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* --------------------------- helpers --------------------------- */

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

  // Weighted sampling without replacement. For each pick, compute the
  // total weight, pick a target, walk the pool. Cheap with O(n) species.
  const wanted = Math.min(n - 1, pool.length);
  const distractors: string[] = [];
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
    distractors.push(remaining[pickedIndex].scientificName);
    remaining.splice(pickedIndex, 1);
  }

  const distractorCandidates = distractors.map((sci) =>
    makeCandidate(sci, commonNameForScientific(sci), imageIndex),
  );

  const all = shuffle([staffCandidate, ...distractorCandidates], rng);
  return { candidates: all, fallback };
}
