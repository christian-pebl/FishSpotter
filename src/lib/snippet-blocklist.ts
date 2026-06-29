import type { Prisma } from "@prisma/client";

/**
 * Snippets intentionally excluded from the FishSpotter app.
 *
 * Keyed by `externalId` (the snip folder name). These clips were marked for
 * exclusion in TRDesk4 and exported with a single-point / no manual centre-track
 * `bbox_data.json`, so they cannot draw a fish trace (only the locate-ring).
 * Rather than re-mark them, they are hidden from every user-facing surface
 * (feed, feed API, archive, landing, public snippet list, sitemap) and skipped
 * by `scripts/sync.ts` so a sync never (re)adds them.
 *
 * This is a non-destructive, reversible exclusion: the rows may still exist in
 * the DB (their answers are preserved), they are just filtered out. To bring a
 * clip back, delete its id here and re-sync (after re-marking it in TRDesk4).
 */
export const EXCLUDED_SNIPPET_EXTERNAL_IDS: readonly string[] = [
  "NORF_2025-10-02_09-00-47_trackmanual_1_0-276_20260619_152957",
  "META_2023-10-01-BRUV1_EXOMATT_D1_OCT23 (5)_trackmanual_1_0-496_20260619_171422",
  "META_2023-10-01-BRUV1_EXOMATT_D1_OCT23 (5)_trackmanual_2_0-8569_20260619_171646",
  "META_2023-10-01-BRUV1_EXOMATT_D1_OCT23 (5)_trackmanual_3_0-15726_20260619_171827",
  "ATLMAR_2025-09-28_13-00-47_trackmanual_5_0-824_20260619_172116",
  "ATLMAR_2025-09-28_13-00-47_trackmanual_6_0-1040_20260619_172234",
  "ATLMAR_2025-09-28_13-00-47_trackmanual_7_0-2538_20260619_172421",
  "OYS_2025-09-25_10-00-52_trackmanual_19_0-920_20260619_174043",
  "OYS_2025-09-21_13-00-53_trackmanual_1_0-567_20260622_090657",
];

const blocked = new Set(EXCLUDED_SNIPPET_EXTERNAL_IDS);

/** True if a snip folder / externalId is on the exclusion list (used by the sync). */
export function isSnippetExcluded(externalId: string): boolean {
  return blocked.has(externalId);
}

/**
 * Prisma `where` fragment that hides snippets the app must never surface.
 * Spread it into any user-facing snippet query, e.g.
 *   `where: { ...existingFilter, ...excludeBlockedSnippetsWhere() }`
 *
 * Two layers, both load-bearing:
 *  - `excluded: false` — the data-driven exclusion. `scripts/sync.ts` mirrors
 *    each snip's `metadata.fishspotter_excluded` (toggled in TRDesk4's "Exclude
 *    from FishSpotter" gallery button) into the `Snippet.excluded` column, so a
 *    deselected snip is hidden everywhere on the next sync, reversibly.
 *  - the static `externalId notIn` list — a hardcoded belt-and-suspenders for
 *    clips excluded before the column existed / outside the sync path.
 */
export function excludeBlockedSnippetsWhere(): Prisma.SnippetWhereInput {
  const where: Prisma.SnippetWhereInput = { excluded: false };
  if (EXCLUDED_SNIPPET_EXTERNAL_IDS.length > 0) {
    where.externalId = { notIn: [...EXCLUDED_SNIPPET_EXTERNAL_IDS] };
  }
  return where;
}
