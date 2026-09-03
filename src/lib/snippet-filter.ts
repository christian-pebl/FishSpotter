/**
 * The clip filter shared by the archive grid and the live feed.
 *
 * The archive's "Launch feed of current filtered videos" button is a promise
 * that the feed you land on holds exactly the clips the grid was showing. That
 * only stays true if both pages build their where-clause from one place, so
 * both import from here rather than each assembling their own. A filter that
 * drifts between the two surfaces is invisible until someone counts the clips.
 *
 * URLs are the other half of that promise and live in `@/lib/archive-url`,
 * which is dependency-free so client components can build links too. The two
 * URL helpers this module always exported are re-exported from there.
 */

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { readSearchParam } from "@/lib/archive-url";
import { excludeBlockedSnippetsWhere } from "@/lib/snippet-blocklist";
import { snippetIdsForSpecies, type SpeciesIndex } from "@/lib/snippet-species";
import { siteLabel } from "@/lib/site-label";

export { feedUrlForFilter, snippetFilterParams } from "@/lib/archive-url";

/**
 * The filter surface. `sort` and `page` are archive-only presentation and
 * deliberately not part of this: they change the order and the window, not the
 * set, and the feed has its own ordering (difficulty ramp + seeded shuffle).
 *
 * `q` has no input of its own any more (the free-text box was replaced by the
 * Species dropdown) but is still honoured, because /farms/[slug] deep-linked to
 * `/feed/browse?q=<deployment>` for six weeks and those links are out there.
 */
export const SnippetFilterSchema = z.object({
  site: z.string().min(1).max(120).optional(),
  species: z.string().min(1).max(80).optional(),
  q: z.string().min(1).max(60).optional(),
});

export type SnippetFilter = z.infer<typeof SnippetFilterSchema>;

const FILTER_KEYS = ["site", "species", "q"] as const;

/**
 * Parse an unknown search-param bag, one field at a time.
 *
 * Per field, not all-or-nothing, and that is the load-bearing part. The
 * archive's filter row is a plain GET form, and a form submits EVERY control,
 * so choosing a location with "All species" left alone arrives here as
 * `{ species: "", site: "Dale Bay", sort: "newest" }`. The previous version
 * validated the whole bag in one go: the empty `species` failed `min(1)`, the
 * bag failed with it, and the page served the unfiltered archive. The sort
 * still applied (it is parsed separately), so the grid visibly reacted, while
 * the count and the "Launch feed" link both described all 139 clips. Measured
 * live on 3 Sep 2026: `?site=Dale+Bay…` gave 7 clips, and the same URL with the
 * form's `species=&sort=newest` appended gave 139.
 *
 * So a blank value means "not set", a value that fails its own rule is dropped
 * on its own, and the other fields stand. `readSearchParam` is the shared rule.
 */
export function parseSnippetFilter(
  raw: Record<string, string | string[] | undefined>,
): SnippetFilter {
  const filter: SnippetFilter = {};
  for (const key of FILTER_KEYS) {
    const value = readSearchParam(raw[key]);
    if (value === undefined) continue;
    const parsed = SnippetFilterSchema.shape[key].safeParse(value);
    if (parsed.success && parsed.data !== undefined) filter[key] = parsed.data;
  }
  return filter;
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

/**
 * Short human summary of an active filter ("Hermit Crab", "Câr-y-Môr · Ramsey
 * Sound, Pembrokeshire, Wales, UK"), for telling a spotter on the feed why they
 * are seeing a subset. The site is printed the way every surface prints one.
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
  if (filter.site) parts.push(siteLabel(filter.site));
  if (filter.q) parts.push(`"${filter.q}"`);
  return parts;
}
