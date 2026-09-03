"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  ARCHIVE_SORTS,
  DEFAULT_ARCHIVE_SORT,
  archiveUrl,
  type ArchiveSort,
} from "@/lib/archive-url";
import type { SiteOption } from "@/lib/archive-facets";
import type { SnippetFilter } from "@/lib/snippet-filter";
import type { SpeciesOption } from "@/lib/snippet-species";

const SORT_LABEL: Record<ArchiveSort, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  site: "Site (A-Z)",
};

const SELECT_CLASS =
  "min-h-[44px] max-w-full rounded-full bg-white/70 px-4 py-2 text-sm text-navy-900 focus:bg-white focus:outline-none";

export type ArchiveFilterBarProps = {
  filter: SnippetFilter;
  sort: ArchiveSort;
  /** Species the community has settled, counted within the selected location. */
  speciesOptions: SpeciesOption[];
  /** Locations with clips, counted within the selected species. */
  siteOptions: SiteOption[];
};

/**
 * The archive's filter row: Species, Location, Sort.
 *
 * Changing a dropdown applies it. The row is still a real GET form underneath,
 * and it shows an Apply button until React has taken over the page: in the
 * server markup, for a reader without JavaScript, and in the moment between
 * the page painting and the script running, when a change would otherwise be
 * lost. Once hydrated the button goes, because a control that applies itself
 * next to a button that also applies it leaves a reader wondering which of the
 * two they were meant to press. That doubt is how "I chose a location and it
 * only re-sorted" starts.
 *
 * The selects hold their own state so a choice shows the moment it is made,
 * while the new page is still on its way. The parent keys this component on
 * the URL, so once the navigation lands (or the reader goes back, or presses
 * Reset) it remounts on the URL's values and the two can never drift.
 */
export function ArchiveFilterBar({ filter, sort, speciesOptions, siteOptions }: ArchiveFilterBarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [species, setSpecies] = useState(filter.species ?? "");
  const [site, setSite] = useState(filter.site ?? "");
  const [sortValue, setSortValue] = useState<ArchiveSort>(sort);
  // False in the server markup and until the effect runs after hydration.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const filtered = !!(filter.species || filter.site || filter.q);

  function navigate(next: { species?: string; site?: string; sort?: ArchiveSort }) {
    const nextSpecies = next.species ?? species;
    const nextSite = next.site ?? site;
    const nextSort = next.sort ?? sortValue;
    const nextFilter: SnippetFilter = {};
    if (nextSpecies) nextFilter.species = nextSpecies;
    if (nextSite) nextFilter.site = nextSite;
    // The deployment deep-link from /farms rides along until Reset, so changing
    // a dropdown cannot silently widen the set back out.
    if (filter.q) nextFilter.q = filter.q;
    startTransition(() => {
      router.push(archiveUrl(nextFilter, { sort: nextSort }));
    });
  }

  return (
    <form
      method="get"
      action="/feed/browse"
      className="flex flex-wrap items-center gap-2"
      aria-label="Filter clips"
      aria-busy={isPending}
      data-hydrated={hydrated ? "" : undefined}
      onSubmit={(e) => {
        e.preventDefault();
        navigate({});
      }}
    >
      {/* Species comes first: it is the cut a visitor actually thinks in. Only
          species the community has settled appear (see @/lib/snippet-species),
          so the list is short and every option returns clips. */}
      <select
        name="species"
        value={species}
        onChange={(e) => {
          setSpecies(e.target.value);
          navigate({ species: e.target.value });
        }}
        aria-label="Filter by species"
        className={SELECT_CLASS}
      >
        <option value="">All species</option>
        {speciesOptions.map((s) => (
          <option key={s.slug} value={s.slug}>
            {s.commonName} ({s.clips})
          </option>
        ))}
      </select>
      <select
        name="site"
        value={site}
        onChange={(e) => {
          setSite(e.target.value);
          navigate({ site: e.target.value });
        }}
        aria-label="Filter by location"
        className={SELECT_CLASS}
      >
        <option value="">All locations</option>
        {siteOptions.map((s) => (
          <option key={s.site} value={s.site}>
            {s.site} ({s.clips})
          </option>
        ))}
      </select>
      <select
        name="sort"
        value={sortValue}
        onChange={(e) => {
          const next = e.target.value as ArchiveSort;
          setSortValue(next);
          navigate({ sort: next });
        }}
        aria-label="Sort clips"
        className={SELECT_CLASS}
      >
        {ARCHIVE_SORTS.map((s) => (
          <option key={s} value={s}>
            {SORT_LABEL[s]}
          </option>
        ))}
      </select>
      {filter.q && (
        <>
          {/* Carried for the no-JavaScript submit; the JS path carries it in navigate(). */}
          <input type="hidden" name="q" value={filter.q} />
          <span className="inline-flex min-h-[44px] max-w-full items-center gap-1 rounded-full bg-white/70 py-1 pl-4 pr-1 text-sm text-navy-900">
            <span className="truncate">Matching &ldquo;{filter.q}&rdquo;</span>
            <Link
              href={archiveUrl({ species: filter.species, site: filter.site }, { sort })}
              aria-label={`Remove the "${filter.q}" filter`}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-navy-900/5"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </Link>
          </span>
        </>
      )}
      {!hydrated && (
        <button
          type="submit"
          className="min-h-[44px] rounded-full bg-teal-500 px-4 py-2 text-sm font-semibold text-navy-900 transition-colors hover:bg-teal-400"
        >
          Apply
        </button>
      )}
      {isPending && (
        <span role="status" className="text-xs text-navy-900/55">
          Updating…
        </span>
      )}
      {(filtered || sort !== DEFAULT_ARCHIVE_SORT) && (
        <Link
          href="/feed/browse"
          className="inline-flex min-h-[44px] items-center px-2 text-xs text-navy-900/55 transition-colors hover:text-navy-900/80"
        >
          Reset
        </Link>
      )}
    </form>
  );
}
