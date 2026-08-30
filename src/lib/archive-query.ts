import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { excludeBlockedSnippetsWhere } from "@/lib/snippet-blocklist";

/**
 * The archive's filter/sort contract, shared by the grid (`/feed/browse`) and
 * the feed it opens into (`/feed/[id]`).
 *
 * It lives here rather than in the grid because the two surfaces have to agree
 * on ONE ordering. Tapping a clip in the archive opens the live feed at that
 * clip and then walks the rest of the archive from it, so "the next clip" is
 * only a truthful promise while both pages build the same `where` and the same
 * `orderBy` from the same params. Two copies of that query would drift, and the
 * drift would be invisible: the feed would simply serve a different next clip
 * than the grid showed, with nothing failing.
 */

export const ARCHIVE_SORTS = ["newest", "oldest", "site"] as const;
export type ArchiveSort = (typeof ARCHIVE_SORTS)[number];

// S4-07: validates the search-params surface server-side so a malformed URL
// falls back to the default view instead of breaking the query.
export const ArchiveSearchSchema = z.object({
  site: z.string().min(1).max(60).optional(),
  q: z.string().min(1).max(60).optional(),
  sort: z.enum(ARCHIVE_SORTS).optional(),
  page: z.coerce.number().int().min(1).max(999).optional(),
});

export type ArchiveSearch = z.infer<typeof ArchiveSearchSchema>;

export function parseArchiveSearch(
  raw: Record<string, string | string[] | undefined>,
): ArchiveSearch {
  const parsed = ArchiveSearchSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

export function archiveWhere(params: ArchiveSearch): Prisma.SnippetWhereInput {
  const where: Prisma.SnippetWhereInput = {};
  if (params.site) where.site = params.site;
  if (params.q) {
    where.OR = [
      { site: { contains: params.q, mode: "insensitive" } },
      { deployment: { contains: params.q, mode: "insensitive" } },
      { staffAnswer: { contains: params.q, mode: "insensitive" } },
    ];
  }
  // Hide intentionally-excluded snippets from the archive list + count.
  Object.assign(where, excludeBlockedSnippetsWhere());
  return where;
}

export function archiveOrderBy(
  sort: ArchiveSort | undefined,
): Prisma.SnippetOrderByWithRelationInput[] {
  // `id` is the tie-break on every sort, and it is load-bearing rather than
  // tidy: `site` puts every clip from one deployment in an arbitrary bucket,
  // and Postgres is free to return that bucket in a different order per query.
  // Without a deterministic tail the grid and the feed could disagree about
  // which clip comes next inside a site, which is exactly the drift this
  // module exists to prevent.
  if (sort === "oldest") return [{ createdAt: "asc" }, { id: "asc" }];
  if (sort === "site") return [{ site: "asc" }, { createdAt: "desc" }, { id: "asc" }];
  return [{ createdAt: "desc" }, { id: "asc" }];
}

/**
 * The filter half of the archive's querystring (site / q / sort, never page).
 *
 * Page is deliberately dropped: the feed keeps going past the grid's page
 * boundary, so pinning it to page 3 would stop the walk 24 clips in.
 */
export function archiveFilterQuery(params: ArchiveSearch): string {
  const qs = new URLSearchParams();
  if (params.site) qs.set("site", params.site);
  if (params.q) qs.set("q", params.q);
  if (params.sort && params.sort !== "newest") qs.set("sort", params.sort);
  return qs.toString();
}

/**
 * Rotate an archive-ordered list so `id` is first and the rest follow in
 * archive order, wrapping past the end back to the start.
 *
 * Wrapping (rather than truncating at the end) is what makes an archive tap
 * behave like the live feed: a clip opened near the bottom of the archive still
 * has somewhere to go after it, and the walk ends one full lap later on the
 * clip just before the one that was tapped.
 *
 * Returns null when the id is not in the list, which is a real case, not a bug:
 * the clip may have been retired, blocklisted, or filtered out by the site/q
 * the URL carried over. The caller decides between re-querying unfiltered and
 * a 404.
 */
export function rotateToClip<T extends { id: string }>(rows: T[], id: string): T[] | null {
  const index = rows.findIndex((r) => r.id === id);
  if (index === -1) return null;
  if (index === 0) return rows;
  return [...rows.slice(index), ...rows.slice(0, index)];
}
