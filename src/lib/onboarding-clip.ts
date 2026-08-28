/**
 * The clip the first-run tour is taught on.
 *
 * The tour's ghost cursor points at a NAMED tile ("Crab", then "Broad oval
 * crabs"), which is only honest if the clip on screen actually contains a crab.
 * The feed is otherwise shuffled per user and ramped by difficulty, so the
 * first card is whatever the ordering picks. For a user who still needs the
 * tour we hoist this one clip to the front: the same clear velvet crab at Pabay
 * that the landing hero is pinned to, so the tour and the landing page teach
 * the same animal.
 *
 * Everything about this is defensive. If the clip has been blocklisted,
 * re-keyed or removed, `pinTutorialClip` reports `pinned: false`, the feed
 * order is untouched, and the tour falls back to shape-agnostic copy with a
 * cursor that circles the grid rather than pointing at a tile. A tour that
 * points at "Crab" over a clip of a pollack would teach the wrong answer on the
 * user's very first identification, which is worse than no cursor at all.
 */
export const TUTORIAL_CLIP_EXTERNAL_ID =
  "KEL33_2026-04-23_08-01_velvetcrab_track_manual_0-696_20260629_112902";

export function pinTutorialClip<T extends { externalId: string }>(
  rows: T[],
): { rows: T[]; pinned: boolean } {
  const index = rows.findIndex((r) => r.externalId === TUTORIAL_CLIP_EXTERNAL_ID);
  if (index <= 0) {
    // -1 = not in the feed at all (blocklisted or gone). 0 = already first,
    // which the ordering may well have done on its own.
    return { rows, pinned: index === 0 };
  }
  const next = [...rows];
  const [clip] = next.splice(index, 1);
  next.unshift(clip);
  return { rows: next, pinned: true };
}
