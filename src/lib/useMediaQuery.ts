"use client";

/**
 * Viewport questions, answered on the FIRST render.
 *
 * Every "is this a wide screen?" check in the app used to be the same four
 * lines: `useState(false)`, then a `useEffect` that asks `matchMedia` and sets
 * the real answer. That is hydration-safe, and it is also a flash: a component
 * that mounts in response to a tap (the Spot It gate, the reveal panel) renders
 * its PHONE layout first, paints it, and only then re-renders as the docked
 * desktop layout. On a laptop or a landscape tablet the identify panel came in
 * as a bottom sheet with the clip squashed into the top half, then jumped to
 * the side, every time it opened (measured 7 Sep 2026: two to three painted
 * frames of the wrong layout per open).
 *
 * `useSyncExternalStore` fixes both halves at once. During hydration React
 * renders with `getServerSnapshot` (false, matching the HTML the server sent),
 * so nothing mismatches; a component mounted AFTER hydration reads the real
 * `matches` on its very first render, so there is no wrong frame to correct.
 * Later changes (rotating a tablet, dragging a window narrower) still re-render
 * through the store's subscription.
 *
 * One `MediaQueryList` per distinct query, shared by every caller. The feed
 * mounts well over a hundred cards, and each of those used to own its own list
 * and its own change listener; they now share one.
 */

import { useCallback, useSyncExternalStore } from "react";

type Entry = { mql: MediaQueryList; listeners: Set<() => void> };

const registry = new Map<string, Entry>();

function entryFor(query: string): Entry | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  let entry = registry.get(query);
  if (!entry) {
    const mql = window.matchMedia(query);
    const listeners = new Set<() => void>();
    const notify = () => listeners.forEach((fn) => fn());
    // Safari < 14 only has the deprecated addListener.
    if (typeof mql.addEventListener === "function") mql.addEventListener("change", notify);
    else if (typeof mql.addListener === "function") mql.addListener(notify);
    entry = { mql, listeners };
    registry.set(query, entry);
  }
  return entry;
}

/** Drop the shared lists. Tests only: production never needs it. */
export function resetMediaQueryRegistry(): void {
  registry.clear();
}

/**
 * True when `query` matches the viewport. `serverValue` is what the server and
 * the hydrating client render (default false), and what a browser with no
 * `matchMedia` gets.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const entry = entryFor(query);
      if (!entry) return () => {};
      entry.listeners.add(onChange);
      return () => {
        entry.listeners.delete(onChange);
      };
    },
    [query],
  );
  const getSnapshot = useCallback(
    () => entryFor(query)?.mql.matches ?? serverValue,
    [query, serverValue],
  );
  const getServerSnapshot = useCallback(() => serverValue, [serverValue]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
