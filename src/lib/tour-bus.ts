"use client";

/**
 * Tiny client event bus for the first-run tour.
 *
 * The tour is a full-screen spotlight overlay that points at the REAL app: the
 * real clip, the real shape gate, the real candidate grid, the real reveal. It
 * therefore has to know when the app moves from one rung to the next, and it
 * lives far away from `FeedCard` in the tree (mounted as a sibling by
 * `src/app/feed/page.tsx`).
 *
 * Rather than lift the whole rung flow into context just so a first-run overlay
 * can read it, the flow emits a window CustomEvent on each transition and the
 * tour listens. Same pattern as `src/lib/pebble-bus.ts` and the `fs-gate`
 * event `TileGate` already dispatches.
 *
 * IMPORTANT: these are "we have ARRIVED at X" signals, not "advance one step".
 * The tour maps each event to the step it belongs to and JUMPS there. That is
 * what keeps the tour honest when the user diverges from the suggested path,
 * skips a rung that does not apply to their shape, or takes the "skip to guess"
 * fast path: the tour follows the app, the app never waits for the tour.
 */

export const TOUR_EVENT = "fishspotter:tour";

export type TourSignal =
  /** Rung 1 opened: the user tapped the clip (or the Identify control). */
  | "identify-opened"
  /** Rung 2 opened: the chosen shape class has a body-form sub-split. */
  | "form-gate-open"
  /** Rung 3 opened: the candidate photo grid is up. */
  | "candidates-open"
  /** The side-by-side look-alike comparison was opened. */
  | "comparison-opened"
  /** A species guide popup ("This is my pick") was opened. */
  | "guide-opened"
  /** A guess was committed; the reveal is coming. */
  | "committed";

export function emitTour(signal: TourSignal): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<TourSignal>(TOUR_EVENT, { detail: signal }));
}

export function onTour(handler: (signal: TourSignal) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => handler((e as CustomEvent<TourSignal>).detail);
  window.addEventListener(TOUR_EVENT, listener);
  return () => window.removeEventListener(TOUR_EVENT, listener);
}
