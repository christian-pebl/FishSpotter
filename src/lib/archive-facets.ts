import type { SpeciesIndex, SpeciesOption } from "@/lib/snippet-species";

/** One entry of the archive's Location dropdown. */
export type SiteOption = { site: string; clips: number };

/**
 * Faceted counts for the archive's two dropdowns.
 *
 * Each dropdown is counted under the OTHER filter: the Location list says how
 * many clips each site holds among the species already chosen, and the Species
 * list says how many clips of each species sit at the site already chosen. So
 * every option offered returns at least one clip, and no combination the two
 * dropdowns can express dead-ends on "No clips match". The value currently
 * selected is always kept, even at zero, so the control keeps reflecting the
 * URL rather than snapping back to "All".
 *
 * These are counts OF the shared where-clause (`snippetFilterWhere` with one
 * field relaxed), not a second implementation of it: the caller runs that
 * where-clause against the database and hands the rows here. What is left is
 * arithmetic, kept pure so it can be unit-tested.
 */

/** Location options from `groupBy site` rows counted under the species filter. */
export function siteOptionsInScope(rows: SiteOption[], selected?: string): SiteOption[] {
  const options = rows.filter((r) => r.clips > 0 || r.site === selected);
  if (selected && !options.some((o) => o.site === selected)) {
    options.push({ site: selected, clips: 0 });
  }
  return options.sort((a, b) => a.site.localeCompare(b.site));
}

/**
 * Species options counted against the clips in scope (the ids the site filter
 * leaves). `index.options` is already alphabetical by common name, and that
 * order is kept.
 */
export function speciesOptionsInScope(
  index: SpeciesIndex,
  idsInScope: ReadonlySet<string>,
  selected?: string,
): SpeciesOption[] {
  const options: SpeciesOption[] = [];
  for (const option of index.options) {
    let clips = 0;
    for (const id of index.snippetIdsBySlug.get(option.slug) ?? []) {
      if (idsInScope.has(id)) clips += 1;
    }
    if (clips > 0 || option.slug === selected) options.push({ ...option, clips });
  }
  return options;
}
