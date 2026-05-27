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
// Q3A-T8 (S7-T1 phase 2): when CONSENSUS_THRESHOLD_USERS or more distinct
// users converge on the same normalised name for a no-reference snippet,
// each matcher's Answer.points gets a one-time +2 bonus (applied by the
// daily consensus-rescore cron). A pending + consensus answer (1 + 2 = 3)
// thus outranks a referenced correct (2), which incentivises being the
// first to ID a no-reference snippet.
export const POINTS_CONSENSUS_BONUS = 2;
export const CONSENSUS_THRESHOLD_USERS = 3;

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
): MatchResult {
  if (staffAnswer === null) {
    return { isCorrect: null, points: POINTS_PENDING_REF };
  }

  const normalizedStaff = normalizeAnswer(staffAnswer);
  const matchKeyStaff = normalizeForMatch(staffAnswer);
  const matchKeyOption = normalizeForMatch(userOption);

  // Fast path: direct match against the staff answer itself.
  if (matchKeyStaff === matchKeyOption) {
    return { isCorrect: true, points: POINTS_CORRECT_REF };
  }

  // Find the alias entry attached to this staff answer. The staff answer
  // may be the canonical form or any registered alias.
  const entry = aliases.find((e) => {
    if (normalizeAnswer(e.canonical) === normalizedStaff) return true;
    return e.aliases.some((a) => normalizeAnswer(a) === normalizedStaff);
  });
  if (!entry) {
    return { isCorrect: false, points: POINTS_INCORRECT };
  }

  // Check the user's option against every acceptable form.
  const acceptable = [entry.canonical, ...entry.aliases];
  const matched = acceptable.some(
    (form) => normalizeForMatch(form) === matchKeyOption,
  );
  return matched
    ? { isCorrect: true, points: POINTS_CORRECT_REF }
    : { isCorrect: false, points: POINTS_INCORRECT };
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
 * snapshot of the whole alias table — only 26 rows).
 */
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { data: AliasEntry[]; expiresAt: number } | null = null;

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
  const aliases = await loadAliases();
  return matchWithAliases(staffAnswer, userOption, aliases);
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

/** Test-only: drop the cache. */
export function __resetAliasCache(): void {
  cache = null;
}
