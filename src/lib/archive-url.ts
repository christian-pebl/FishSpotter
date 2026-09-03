/**
 * The archive's URL grammar, in one place.
 *
 * Three surfaces link into and out of the video archive (the grid itself, the
 * live feed it launches, and a clip opened from a card), and a farm page and a
 * species page link into it from outside. Each used to assemble its own query
 * string. This module is the only place a filter and a view become a URL, so a
 * selection has exactly one address: defaults are left off, empty values are
 * never written, and the params come out in a fixed order. That is what makes
 * a shared link stable, and what lets "Reset" mean something.
 *
 * Deliberately dependency-free (no Prisma, no zod, no database): client
 * components build their links with it. They must not import
 * `@/lib/snippet-filter`, which reaches the species index and through that the
 * database; that module re-exports the pieces of this one it always offered,
 * so its existing callers are unaffected.
 */

import type { SnippetFilter } from "@/lib/snippet-filter";

export const ARCHIVE_SORTS = ["newest", "oldest", "site"] as const;
export type ArchiveSort = (typeof ARCHIVE_SORTS)[number];
export const DEFAULT_ARCHIVE_SORT: ArchiveSort = "newest";

/** The archive's presentation half: how the set is ordered and which window of it is shown. */
export type ArchiveView = { sort?: ArchiveSort; page?: number };

/**
 * The filter as query params: the SET half only, never sort or page. Order is
 * fixed (species, site, q) so equal selections serialise identically.
 */
export function snippetFilterParams(filter: SnippetFilter): URLSearchParams {
  const qs = new URLSearchParams();
  if (filter.species) qs.set("species", filter.species);
  if (filter.site) qs.set("site", filter.site);
  if (filter.q) qs.set("q", filter.q);
  return qs;
}

function withQuery(path: string, qs: URLSearchParams): string {
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

/**
 * `/feed/browse` showing this selection. With no view this is the selection's
 * canonical address, the one to share: sort and page are how one person is
 * looking at the set, not part of the set.
 */
export function archiveUrl(filter: SnippetFilter, view: ArchiveView = {}): string {
  const qs = snippetFilterParams(filter);
  if (view.sort && view.sort !== DEFAULT_ARCHIVE_SORT) qs.set("sort", view.sort);
  if (view.page && view.page > 1) qs.set("page", String(Math.floor(view.page)));
  return withQuery("/feed/browse", qs);
}

/** `/feed` holding this selection, the target of "Launch feed of current filtered videos". */
export function feedUrlForFilter(filter: SnippetFilter): string {
  return withQuery("/feed", snippetFilterParams(filter));
}

/**
 * A clip opened from the grid. It carries the grid's filter and sort so the
 * feed it opens into walks the same list in the same order, and never the
 * page: the feed runs past the page boundary.
 */
export function clipUrl(id: string, filter: SnippetFilter, sort?: ArchiveSort): string {
  const qs = snippetFilterParams(filter);
  if (sort && sort !== DEFAULT_ARCHIVE_SORT) qs.set("sort", sort);
  return withQuery(`/feed/${id}`, qs);
}

/**
 * One search param, read the way both of the archive's parsers read it: a blank
 * value means "not set", and a repeated key (`?site=a&site=b`) is dropped,
 * since a link that says two things about one field is not saying either.
 *
 * Blank-means-unset is the load-bearing half. The filter row is a GET form, and
 * a form submits every control, so choosing a location with "All species" left
 * alone arrives as `?species=&site=Dale+Bay`. Anything that treats that empty
 * `species` as an error discards the location with it.
 */
export function readSearchParam(value: string | string[] | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
