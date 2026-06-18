/**
 * Alias-aware answer matching for the quiz pipeline.
 *
 * Given a snippet's `staffAnswer` (which may be a scientific binomial OR
 * a common name, depending on the source metadata) and a user's typed
 * answer, decide whether to mark them correct AND how many points to
 * award. The matcher accepts:
 *
 *   1. Exact normalised match against the staff answer itself
 *   2. Any registered alias from the SpeciesAlias table
 *   3. Singular/plural variants (via normalizeForMatch — see normalize-answer.ts)
 *
 * When `staffAnswer` is null (no reference identification exists yet),
 * `isCorrect` is null and the user receives a flat participation bonus
 * (POINTS_PENDING_REF). Phase 2 will retro-credit additional points
 * once community consensus forms (S7-T2).
 *
 * Aliases live in src/data/species-aliases.json (editorial) and are
 * seeded into the SpeciesAlias table by scripts/seed-aliases.ts.
 */

import { normalizeAnswer, normalizeForMatch } from "@/lib/normalize-answer";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { SHAPE_CLASS, type ShapeClass } from "@/lib/idguide/traits";
import { CONSENSUS_THRESHOLD_USERS } from "@/lib/pebbles";

// Sea-currency redesign: the consensus threshold now lives in the Pebbles
// economy module (pebbles.ts), the single source of truth for all scoring
// constants. Re-exported here so existing importers keep working.
export { CONSENSUS_THRESHOLD_USERS };

export interface AliasEntry {
  canonical: string;
  aliases: string[];
}

/**
 * Scoring constants. Pending is deliberately *less* than correct so a
 * spotter can't farm un-referenced clips at a better rate than referenced
 * ones — pure participation gets a small reward, the bigger payout
 * arrives via the consensus retro-bonus (S7-T2).
 */
export const POINTS_CORRECT_REF = 2;
export const POINTS_PENDING_REF = 1;
export const POINTS_INCORRECT = 0;
// "Spot It" Workstream E (scored-by-rung, locked 1 Jun 2026): a guess that
// misses the species but lands the right SHAPE CLASS (the user correctly saw
// "it's a crab" but picked the wrong crab) earns partial credit. Locked at 1:
// Answer.points is an Int so nothing fits between 1 and 2, and bumping species
// to 3 would break the consensus-pioneer invariant (1 + bonus 2 must out-rank a
// referenced species correct = 2). isCorrect stays false — only a species hit
// is "correct"; the reveal derives a "close" treatment from points === 1 in
// UX-4 without a schema change.
export const POINTS_SHAPE_CLASS = 1;
// Legacy reference-era scoring constants are retained only for the
// matchWithAliases unit tests and any transitional callers. The live
// economy (Pebbles) no longer uses a staffAnswer reference — see pebbles.ts
// and src/lib/consensus.ts. CONSENSUS_THRESHOLD_USERS is re-exported above
// from pebbles.ts (the single source of truth).
export const POINTS_CONSENSUS_BONUS = 2;

export interface MatchResult {
  /** True if matched the reference; false if didn't; null if no reference exists. */
  isCorrect: boolean | null;
  /** Points awarded for this submission. */
  points: number;
}

/**
 * Pure matcher — given an explicit alias list. Use this for tests and any
 * caller that wants to control the alias source (e.g. mocking).
 *
 * Match strategy:
 *   - If staffAnswer is null: return { isCorrect: null, points: POINTS_PENDING_REF }.
 *   - Build the set of acceptable forms: [staffAnswer, canonical, ...aliases]
 *   - Find the alias entry whose canonical or aliases include the staff
 *     answer (so the entry attaches to the right species).
 *   - Compare the user's option, normalised AND singularised, against the
 *     acceptable set normalised AND singularised the same way.
 */
export function matchWithAliases(
  staffAnswer: string | null,
  userOption: string,
  aliases: AliasEntry[],
  /**
   * Optional normalised-form → shape class map (see buildShapeClassByForm).
   * When supplied, a guess that misses the species but matches the reference's
   * shape class earns POINTS_SHAPE_CLASS instead of 0. Omit it to get the
   * pre-Workstream-E species-only behaviour (used by the alias unit tests).
   */
  shapeClassByForm?: ReadonlyMap<string, ShapeClass>,
): MatchResult {
  if (staffAnswer === null) {
    return { isCorrect: null, points: POINTS_PENDING_REF };
  }

  const normalizedStaff = normalizeAnswer(staffAnswer);
  const matchKeyStaff = normalizeForMatch(staffAnswer);
  const matchKeyOption = normalizeForMatch(userOption);

  // --- Rung 1: species-level match (exact or alias-resolved) -----------------
  let speciesMatch = matchKeyStaff === matchKeyOption;
  if (!speciesMatch) {
    // Find the alias entry attached to this staff answer. The staff answer
    // may be the canonical form or any registered alias.
    const entry = aliases.find((e) => {
      if (normalizeAnswer(e.canonical) === normalizedStaff) return true;
      return e.aliases.some((a) => normalizeAnswer(a) === normalizedStaff);
    });
    if (entry) {
      const acceptable = [entry.canonical, ...entry.aliases];
      speciesMatch = acceptable.some(
        (form) => normalizeForMatch(form) === matchKeyOption,
      );
    }
  }
  if (speciesMatch) {
    return { isCorrect: true, points: POINTS_CORRECT_REF };
  }

  // --- Rung 2: shape-class partial credit (Workstream E) ---------------------
  // Wrong species — but did they at least nail the shape class? The reference's
  // species implies its shape class via the catalogue; a coarse reference
  // ("Crab") maps to itself. isCorrect stays false (only a species hit is
  // "correct"); the points carry the partial-credit signal.
  if (shapeClassByForm) {
    const refShape = shapeClassByForm.get(matchKeyStaff);
    const guessShape = shapeClassByForm.get(matchKeyOption);
    if (refShape && guessShape && refShape === guessShape) {
      return { isCorrect: false, points: POINTS_SHAPE_CLASS };
    }
  }

  return { isCorrect: false, points: POINTS_INCORRECT };
}

/**
 * The catalogue's scientificName ↔ commonName pairing is itself alias data:
 * a snippet referenced by binomial ("Cancer pagurus") must species-match the
 * common name a spotter picks from the strip ("Edible Crab"). The DB alias
 * table (species-aliases.json) carries the editorial synonyms on top; merging
 * the two means a species link never depends on a separate seed step. Static
 * (the catalogue is a build-time import), so compute once.
 */
export const CATALOGUE_ALIASES: AliasEntry[] = Object.entries(CATALOGUE).map(
  ([scientificName, traits]) => ({
    canonical: scientificName,
    aliases: traits.commonName ? [traits.commonName] : [],
  }),
);

/**
 * Resolve a (possibly common/vernacular) name to a catalogue scientific name
 * using local alias data, or null if it isn't a species the catalogue covers.
 *
 * This is the local-first counterpart to the GBIF name match. GBIF's
 * `species/match` only resolves *scientific* names — it returns NONE for
 * vernaculars ("common whiting", "juvenile cod") — so common-name staff answers
 * never resolved through it. The catalogue already pairs every scientific name
 * with its common name(s), and `species-aliases.json` adds editorial synonyms,
 * so for any species the product actually covers we can resolve offline and
 * exactly, reserving GBIF for names outside the catalogue.
 *
 * Returns the alias entry's `canonical`, which for both CATALOGUE_ALIASES and
 * the species-aliases table is the scientific binomial. Coarse shape words
 * ("crab") are deliberately NOT alias canonicals, so they return null here
 * rather than being forced onto a species.
 */
export function scientificFromLocalName(
  name: string,
  aliases: AliasEntry[],
): string | null {
  const key = normalizeForMatch(name);
  if (!key) return null;
  for (const entry of aliases) {
    if (normalizeForMatch(entry.canonical) === key) return entry.canonical;
    if (entry.aliases.some((a) => normalizeForMatch(a) === key)) return entry.canonical;
  }
  return null;
}

/**
 * Builds the normalised-form → shape class lookup used for partial credit.
 *
 * Sources, in precedence order (earlier wins, so a species name is never
 * clobbered by a coarse word):
 *   1. The trait catalogue: every species' scientific name + common name.
 *   2. Aliases: each alias entry inherits the shape class of whichever of its
 *      forms the catalogue already knows, so "pollock"/"dogfish" resolve too.
 *   3. The coarse shape words themselves ("crab" → crab), enabling shape-level
 *      references and shape-level guesses (the nullify-audit reframe).
 *
 * All keys are normalised with normalizeForMatch so they compare against the
 * same keys matchWithAliases derives from the reference and the guess.
 */
export function buildShapeClassByForm(
  aliases: AliasEntry[],
): Map<string, ShapeClass> {
  const map = new Map<string, ShapeClass>();

  for (const [scientificName, traits] of Object.entries(CATALOGUE)) {
    map.set(normalizeForMatch(scientificName), traits.shapeClass);
    if (traits.commonName) {
      map.set(normalizeForMatch(traits.commonName), traits.shapeClass);
    }
  }

  for (const entry of aliases) {
    const forms = [entry.canonical, ...entry.aliases];
    let shape: ShapeClass | undefined;
    for (const form of forms) {
      const found = map.get(normalizeForMatch(form));
      if (found) {
        shape = found;
        break;
      }
    }
    if (shape) {
      for (const form of forms) {
        const key = normalizeForMatch(form);
        if (!map.has(key)) map.set(key, shape);
      }
    }
  }

  for (const shapeClass of SHAPE_CLASS) {
    const key = normalizeForMatch(shapeClass);
    if (!map.has(key)) map.set(key, shapeClass);
  }

  return map;
}

/**
 * Legacy boolean shim — kept so test files and any callers that only need
 * the boolean continue to work. New callers should use `matchWithAliases`.
 */
export function isCorrectWithAliases(
  staffAnswer: string | null,
  userOption: string,
  aliases: AliasEntry[],
): boolean {
  return matchWithAliases(staffAnswer, userOption, aliases).isCorrect === true;
}

/**
 * Module-scope 5-minute TTL cache so a snippet quiz session doesn't hit
 * Prisma for every submission. Cache is keyed by nothing (single-shot
 * snapshot of the whole alias table — it is small).
 */
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { data: AliasEntry[]; expiresAt: number } | null = null;
// The shape-class map is derived from the (static) catalogue + the alias
// snapshot, so it shares the alias TTL.
let shapeCache: { data: Map<string, ShapeClass>; expiresAt: number } | null = null;

/**
 * Loads the alias table from the DB with a 5-min TTL cache. Server-only
 * (imports the Prisma client). Returns [] if the SpeciesAlias table
 * hasn't been seeded yet — match degrades to direct staff-answer
 * comparison, identical to the pre-S2-T01 behaviour.
 */
export async function loadAliases(): Promise<AliasEntry[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.data;

  // Lazy import so test files that exercise matchWithAliases never
  // pull Prisma in.
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.speciesAlias.findMany({
    select: { canonical: true, aliases: true },
  });
  cache = { data: rows, expiresAt: Date.now() + CACHE_TTL_MS };
  return rows;
}

/**
 * Production matcher — same logic as matchWithAliases but loads
 * aliases from the DB. Returns the full MatchResult.
 */
export async function matchAnswer(
  staffAnswer: string | null,
  userOption: string,
): Promise<MatchResult> {
  // Catalogue-derived species links first, then editorial DB synonyms.
  const aliases = [...CATALOGUE_ALIASES, ...(await loadAliases())];
  if (!shapeCache || shapeCache.expiresAt <= Date.now()) {
    shapeCache = {
      data: buildShapeClassByForm(aliases),
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
  }
  return matchWithAliases(staffAnswer, userOption, aliases, shapeCache.data);
}

/**
 * Boolean shim — used by callers that don't need the points yet.
 * Prefer `matchAnswer` going forward.
 */
export async function isCorrectAnswer(
  staffAnswer: string | null,
  userOption: string,
): Promise<boolean> {
  return (await matchAnswer(staffAnswer, userOption)).isCorrect === true;
}

/** Test-only: drop the caches. */
export function __resetAliasCache(): void {
  cache = null;
  shapeCache = null;
}
