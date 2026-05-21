/**
 * Alias-aware answer matching for the quiz pipeline.
 *
 * Given a snippet's `staffAnswer` (which may be a scientific binomial OR
 * a common name, depending on the source metadata) and a user's typed
 * answer, decide whether to mark them correct. The matcher accepts:
 *
 *   1. Exact normalised match against the staff answer itself
 *   2. Any registered alias from the SpeciesAlias table
 *   3. Singular/plural variants (via normalizeForMatch — see normalize-answer.ts)
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
 * Pure matcher — given an explicit alias list. Use this for tests and any
 * caller that wants to control the alias source (e.g. mocking).
 *
 * Match strategy:
 *   - Build the set of acceptable forms: [staffAnswer, canonical, ...aliases]
 *   - Find the alias entry whose canonical or aliases include the staff
 *     answer (so the entry attaches to the right species).
 *   - Compare the user's option, normalised AND singularised, against the
 *     acceptable set normalised AND singularised the same way.
 */
export function isCorrectWithAliases(
  staffAnswer: string,
  userOption: string,
  aliases: AliasEntry[],
): boolean {
  const normalizedStaff = normalizeAnswer(staffAnswer);
  const matchKeyStaff = normalizeForMatch(staffAnswer);
  const matchKeyOption = normalizeForMatch(userOption);

  // Fast path: direct match against the staff answer itself.
  if (matchKeyStaff === matchKeyOption) return true;

  // Find the alias entry attached to this staff answer. The staff answer
  // may be the canonical form or any registered alias.
  const entry = aliases.find((e) => {
    if (normalizeAnswer(e.canonical) === normalizedStaff) return true;
    return e.aliases.some((a) => normalizeAnswer(a) === normalizedStaff);
  });
  if (!entry) return false;

  // Check the user's option against every acceptable form.
  const acceptable = [entry.canonical, ...entry.aliases];
  return acceptable.some(
    (form) => normalizeForMatch(form) === matchKeyOption,
  );
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

  // Lazy import so test files that exercise isCorrectWithAliases never
  // pull Prisma in.
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.speciesAlias.findMany({
    select: { canonical: true, aliases: true },
  });
  cache = { data: rows, expiresAt: Date.now() + CACHE_TTL_MS };
  return rows;
}

/**
 * Production matcher — same logic as isCorrectWithAliases but loads
 * aliases from the DB.
 */
export async function isCorrectAnswer(
  staffAnswer: string,
  userOption: string,
): Promise<boolean> {
  const aliases = await loadAliases();
  return isCorrectWithAliases(staffAnswer, userOption, aliases);
}

/** Test-only: drop the cache. */
export function __resetAliasCache(): void {
  cache = null;
}
