/**
 * Which card of the feed is "on stage" (active: playing, tappable, not inert).
 *
 * The feed is a vertical scroll-snap list in which every card is exactly one
 * container tall, so the card on screen is a matter of arithmetic on the
 * scroll position. It is held by the card's KEY (its snippet id), not its
 * position: when the order changes, "active" must stay with the card being
 * watched, never pass to whichever card slid into its old slot. Getting that
 * wrong left the card on screen inert and paused (28 Sep 2026: the frozen
 * first clip after the guest gate's refresh, and an empty screen after Next).
 *
 * Pure module (no React, no DOM), so it's trivial to test.
 */

/** The card on stage: its key, and the index it was last seen at, which is
 *  used only if that card has since left the feed. */
export interface Stage {
  key: string | null;
  index: number;
}

/**
 * The index of the card a feed scrolled to `scrollTop` is showing: the one
 * covering more than half the screen, so it changes at the halfway point.
 * Clamped to the cards that exist; -1 when there are none or no height yet.
 */
export function indexAtScroll(scrollTop: number, cardHeight: number, count: number): number {
  if (count <= 0 || cardHeight <= 0) return -1;
  return Math.max(0, Math.min(count - 1, Math.round(scrollTop / cardHeight)));
}

/**
 * Where the card on stage is in the current order (`keys`, one per card, in
 * render order). Follows the key through any reorder; if that card has left
 * the feed, falls back to its last index, clamped to the feed's length.
 */
export function stageIndex(keys: readonly string[], stage: Stage): number {
  const keyed = stage.key === null ? -1 : keys.indexOf(stage.key);
  if (keyed >= 0) return keyed;
  return Math.min(stage.index, Math.max(0, keys.length - 1));
}
