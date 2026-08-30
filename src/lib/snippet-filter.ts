/**
 * The clip filter shared by the archive grid and the live feed.
 *
 * The archive's "Launch feed of current filtered videos" button is a promise
 * that the feed you land on holds exactly the clips the grid was showing. That
 * only stays true if both pages build their where-clause from one place, so
 * both import from here rather than each assembling their own. A filter that
 * drifts between the two surfaces is invisible until someone counts the clips.
 */

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { excludeBlockedSnippetsWhere } from "@/lib/snippet-blocklist";
import { snippetIdsForSpecies, type SpeciesIndex } from "@/lib/snippet-species";

/**
 * The filter surface. `sort` and `page` are archive-only presentation and
 * deliberately not part of this: they change the order and the window, not the
 * set, and the feed has its own ordering (difficulty ramp + seeded shuffle).
 *
 * `q` has no input of its own any more (the free-text box was replaced by the
 * Species dropdown) but is still honoured, because /farms/[slug] deep-links to
 * `/feed/browse?q=<deployment>` and that entry point must keep working.
 */
export const SnippetFilterSchema = z.object({
  site: z.string().min(1).max(60).optional(),
  species: z.string().min(1).max(80).optional(),
  q: z.string().min(1).max(60).optional(),
});

export type SnippetFilter = z.infer<typeof SnippetFilterSchema>;

/** Parse an unknown search-param bag; a malformed one falls back to no filter. */
export function parseSnippetFilter(
  raw: Record<string, string | string[] | undefined>,
): SnippetFilter {
  const parsed = SnippetFilterSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

/**
 * Drop a species slug the index does not know about (a stale bookmark, or a
 * species whose last clip lost its consensus). Returning undefined shows the
 * unfiltered archive rather than an empty grid the reader cannot explain.
 */
export function resolveSpeciesFilter(
  filter: SnippetFilter,
  index: SpeciesIndex,
): SnippetFilter {
  if (filter.species && !index.optionBySlug.has(filter.species)) {
    const { species: _dropped, ...rest } = filter;
    return rest;
  }
  return filter;
}

/** True when the filter actually narrows anything. */
export function hasSnippetFilter(filter: SnippetFilter): boolean {
  return !!(filter.site || filter.species || filter.q);
}

/**
 * Prisma where-clause for the filter, always including the blocklist so no
 * caller can forget it.
 */
export function snippetFilterWhere(
  filter: SnippetFilter,
  index: SpeciesIndex,
): Prisma.SnippetWhereInput {
  const where: Prisma.SnippetWhereInput = { ...excludeBlockedSnippetsWhere() };
  if (filter.site) where.site = filter.site;
  if (filter.species) {
    // An unknown slug yields [], i.e. no clips. Callers should run the filter
    // through resolveSpeciesFilter first so that only happens for a species
    // that genuinely has no clips left.
    where.id = { in: snippetIdsForSpecies(index, filter.species) };
  }
  if (filter.q) {
    where.OR = [
      { site: { contains: filter.q, mode: "insensitive" } },
      { deployment: { contains: filter.q, mode: "insensitive" } },
      { staffAnswer: { contains: filter.q, mode: "insensitive" } },
    ];
  }
  return where;
}

/** The filter as query params, for building links between the two surfaces. */
export function snippetFilterParams(filter: SnippetFilter): URLSearchParams {
  const qs = new URLSearchParams();
  if (filter.species) qs.set("species", filter.species);
  if (filter.site) qs.set("site", filter.site);
  if (filter.q) qs.set("q", filter.q);
  return qs;
}

/** `/feed` carrying this filter. */
export function feedUrlForFilter(filter: SnippetFilter): string {
  const qs = snippetFilterParams(filter).toString();
  return qs ? `/feed?${qs}` : "/feed";
}

/**
 * Short human summary of an active filter ("Hermit Crab · Ramsey Sound"), for
 * telling a spotter on the feed why they are seeing a subset.
 */
export function describeSnippetFilter(
  filter: SnippetFilter,
  index: SpeciesIndex,
): string[] {
  const parts: string[] = [];
  const species = filter.species
    ? index.optionBySlug.get(filter.species)
    : undefined;
  if (species) parts.push(species.commonName);
  if (filter.site) parts.push(filter.site);
  if (filter.q) parts.push(`"${filter.q}"`);
  return parts;
}
