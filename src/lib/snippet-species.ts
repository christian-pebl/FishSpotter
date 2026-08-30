/**
 * Which species is in a clip, for the archive's Species filter.
 *
 * There is no per-clip species column to read. `Snippet.staffAnswer` looks like
 * one but is not: measured 30 Aug 2026 across the live DB its only values are
 * "", "Fish", "Crab", "Scooter", "Jellyfish", "Flatfish", "Gastropod",
 * "Starfish", "hermit", "jelly", "large fish", "small fish". Those are shape
 * words, not species, and 69 of 163 clips carry the empty string. Filtering a
 * dropdown labelled "Species" off that field would offer the reader eight
 * shape words and call them species.
 *
 * So the species comes from where the app already says it comes from: the
 * crowd. Since the 18 Jun 2026 sea-currency redesign the community IS the
 * authority (src/lib/consensus.ts), and a clip's species is the option the most
 * distinct spotters have converged on, once CONSENSUS_THRESHOLD_USERS of them
 * agree. That is the same leader definition `pickLeaderGroup` pays Pebbles on,
 * derived here from the same grouping key (`normalizeForMatch`) so the two can
 * never disagree about who won a clip.
 *
 * Two deliberate narrowings on top of the leader:
 *
 *   - A leader only becomes a filter option if it resolves to a CATALOGUE
 *     species (`scientificFromLocalName`). Coarse shape words are deliberately
 *     not alias canonicals, so a clip whose community leader is "flatfish"
 *     settles on a shape, not a species, and is left out of a Species filter
 *     rather than being forced onto one of the three flatfish.
 *   - The label shown is the catalogue's `commonName`, not the surface form the
 *     most spotters happened to type, so the dropdown reads with one editorial
 *     voice ("Lesser-spotted catshark") instead of a vote between
 *     "Lesser-spotted catshark" and "lesser spotted Catshark".
 *
 * Consequence worth stating plainly: this index covers only the clips the
 * community has actually settled (39 of 143 visible clips on 30 Aug 2026, 20
 * species). It grows as people play. A clip nobody has settled has no species
 * and is reachable only with the Species filter cleared, which is the honest
 * behaviour: the alternative is labelling a clip from one person's guess.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import {
  CATALOGUE_ALIASES,
  loadAliases,
  scientificFromLocalName,
  type AliasEntry,
} from "@/lib/answer-matching";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { normalizeForMatch } from "@/lib/normalize-answer";
import { CONSENSUS_THRESHOLD_USERS } from "@/lib/pebbles";
import { speciesSlug } from "@/lib/species-slug";
import { excludeBlockedSnippetsWhere } from "@/lib/snippet-blocklist";

/**
 * One (clip, answer-surface-form) tally. `spotters` is the number of DISTINCT
 * users who gave that surface form on that clip, which `Answer`'s
 * `@@unique([userId, snippetId])` makes identical to the row count.
 */
export type SpeciesTallyRow = {
  snippetId: string;
  chosenOption: string;
  spotters: number;
};

export type SpeciesOption = {
  /** URL-safe id, the species-guide slug ("pagurus-bernhardus"). */
  slug: string;
  scientificName: string;
  /** Catalogue display name ("Hermit Crab"). */
  commonName: string;
  /** How many clips the community has settled on this species. */
  clips: number;
};

export type SpeciesIndex = {
  /** Every settled species, alphabetical by common name. */
  options: SpeciesOption[];
  /** slug -> the clips settled on it. */
  snippetIdsBySlug: Map<string, string[]>;
  /** slug -> its option row, for labelling a filter that is already applied. */
  optionBySlug: Map<string, SpeciesOption>;
};

const EMPTY_INDEX: SpeciesIndex = {
  options: [],
  snippetIdsBySlug: new Map(),
  optionBySlug: new Map(),
};

/**
 * Pure index builder. Takes raw per-clip answer tallies and the alias list,
 * returns the settled species and the clips under each.
 */
export function buildSpeciesIndex(
  rows: SpeciesTallyRow[],
  aliases: AliasEntry[],
  threshold: number = CONSENSUS_THRESHOLD_USERS,
): SpeciesIndex {
  // Collapse each clip's answers onto the consensus grouping key, so
  // "Hermit crab" and "hermit crabs" count towards the same camp.
  const perSnippet = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (row.spotters <= 0) continue;
    const key = normalizeForMatch(row.chosenOption);
    if (!key) continue;
    let camps = perSnippet.get(row.snippetId);
    if (!camps) {
      camps = new Map();
      perSnippet.set(row.snippetId, camps);
    }
    camps.set(key, (camps.get(key) ?? 0) + row.spotters);
  }

  const snippetIdsBySlug = new Map<string, string[]>();
  const scientificBySlug = new Map<string, string>();

  for (const [snippetId, camps] of perSnippet) {
    // Same ordering as consensus.pickLeaderGroup: most spotters wins, ties
    // break on the normalised name so the answer is stable across requests.
    const leader = Array.from(camps.entries()).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0];
    if (!leader || leader[1] < threshold) continue;

    const scientificName = scientificFromLocalName(leader[0], aliases);
    // Not a catalogue species (a shape word like "flatfish", or a name the
    // catalogue does not cover). It has a settled community answer, just not
    // one a Species filter can honestly stand behind.
    if (!scientificName || !CATALOGUE[scientificName]) continue;

    const slug = speciesSlug(scientificName);
    scientificBySlug.set(slug, scientificName);
    const ids = snippetIdsBySlug.get(slug);
    if (ids) ids.push(snippetId);
    else snippetIdsBySlug.set(slug, [snippetId]);
  }

  const options: SpeciesOption[] = Array.from(snippetIdsBySlug.entries())
    .map(([slug, ids]) => {
      const scientificName = scientificBySlug.get(slug) as string;
      return {
        slug,
        scientificName,
        commonName: CATALOGUE[scientificName].commonName,
        clips: ids.length,
      };
    })
    .sort((a, b) => a.commonName.localeCompare(b.commonName));

  return {
    options,
    snippetIdsBySlug,
    optionBySlug: new Map(options.map((o) => [o.slug, o])),
  };
}

/**
 * DB-backed builder. One grouped query over Answer, scoped to the snippets the
 * caller can actually surface (blocked / excluded clips are left out by
 * default, so the dropdown never offers a species whose only clip is hidden).
 */
export async function loadSpeciesIndex(
  prisma: PrismaClient,
  snippetWhere: Prisma.SnippetWhereInput = excludeBlockedSnippetsWhere(),
): Promise<SpeciesIndex> {
  const [rows, dbAliases] = await Promise.all([
    prisma.answer.groupBy({
      by: ["snippetId", "chosenOption"],
      where: { snippet: snippetWhere },
      _count: { _all: true },
    }),
    loadAliases(),
  ]);
  return buildSpeciesIndex(
    rows.map((r) => ({
      snippetId: r.snippetId,
      chosenOption: r.chosenOption,
      spotters: r._count._all,
    })),
    // Catalogue-derived links first, then the editorial synonyms, the same
    // precedence matchAnswer uses.
    [...CATALOGUE_ALIASES, ...dbAliases],
  );
}

/** The clips settled on `slug`, or an empty list for an unknown slug. */
export function snippetIdsForSpecies(index: SpeciesIndex, slug: string): string[] {
  return index.snippetIdsBySlug.get(slug) ?? [];
}

/** An index with nothing in it, for callers that need a filter-free fallback. */
export function emptySpeciesIndex(): SpeciesIndex {
  return EMPTY_INDEX;
}
