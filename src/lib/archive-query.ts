import type { Prisma } from "@prisma/client";
import { z } from "zod";

/**
 * The archive's ORDER, and the rotation that turns it into a feed.
 *
 * The archive's FILTER lives in `@/lib/snippet-filter`, which the grid and the
 * live feed already share. This is the other half, and it is separate for the
 * reason that module states about itself: the filter decides the SET, and the
 * set has to be identical on both surfaces. Order and window are archive-only,
 * because `/feed` runs its own ordering (difficulty ramp plus seeded shuffle).
 *
 * Where the two meet is a clip opened from the archive. That feed is the one
 * place order matters as much as the set, because "the next clip is the next
 * one in the archive" is only a truthful promise while the grid and the feed
 * sort the same way. Two copies of the sort would drift, and the drift would be
 * invisible: the feed would simply serve a different next clip than the grid
 * showed, with nothing failing.
 */

export const ARCHIVE_SORTS = ["newest", "oldest", "site"] as const;
export type ArchiveSort = (typeof ARCHIVE_SORTS)[number];

/** The presentation half of the archive's search params (the set half is
 *  `SnippetFilterSchema`). A malformed value falls back to the default view. */
export const ArchiveSortSchema = z.object({
  sort: z.enum(ARCHIVE_SORTS).optional(),
  page: z.coerce.number().int().min(1).max(999).optional(),
});

export type ArchiveSortParams = z.infer<typeof ArchiveSortSchema>;

export function parseArchiveSort(
  raw: Record<string, string | string[] | undefined>,
): ArchiveSortParams {
  const parsed = ArchiveSortSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

export function archiveOrderBy(
  sort: ArchiveSort | undefined,
): Prisma.SnippetOrderByWithRelationInput[] {
  // `id` is the tie-break on every sort, and it is load-bearing rather than
  // tidy: `site` puts every clip from one deployment in an arbitrary bucket,
  // and Postgres is free to return that bucket in a different order per query.
  // Without a deterministic tail the grid and the feed could disagree about
  // which clip comes next inside a site.
  if (sort === "oldest") return [{ createdAt: "asc" }, { id: "asc" }];
  if (sort === "site") return [{ site: "asc" }, { createdAt: "desc" }, { id: "asc" }];
  return [{ createdAt: "desc" }, { id: "asc" }];
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
 * the clip may have been retired, blocklisted, or filtered out by the params
 * the URL carried over. The caller decides between re-querying unfiltered and
 * a 404.
 */
export function rotateToClip<T extends { id: string }>(rows: T[], id: string): T[] | null {
  const index = rows.findIndex((r) => r.id === id);
  if (index === -1) return null;
  if (index === 0) return rows;
  return [...rows.slice(index), ...rows.slice(0, index)];
}
