"use client";

import { useSyncExternalStore } from "react";

/**
 * True once the browser has put the page's first content on screen.
 *
 * The landing page used to start everything at once: the hero poster, the
 * looping hero clip, 18 decorative silhouette masks and twenty photos that sit
 * below the fold. On a phone connection they all shared one thin pipe, so the
 * picture a visitor is actually waiting for (the hero poster) arrived last.
 * Measured 12 Nov 2026 (Lighthouse mobile, production): largest contentful
 * paint 8.5 to 8.7 s on a page whose text painted in 1.1 s.
 *
 * Decoration and below-the-fold media wait for this to turn true. Nothing is
 * removed, it just queues behind the first frame instead of in front of it.
 *
 * One shared observer, so any number of components can ask. It uses the Paint
 * Timing entry because that is reported after the frame is really presented;
 * `requestAnimationFrame` fires before the paint, which on a slow raster is
 * still hundreds of milliseconds early. Browsers without Paint Timing, and tabs
 * opened in the background (which never paint), fall through on the timer.
 *
 * `useSyncExternalStore` with a `false` server snapshot keeps hydration honest:
 * the server and the first client render always agree on "not yet".
 */

/** Longest anything waits when no paint is ever reported. */
export const FIRST_PAINT_FALLBACK_MS = 2500;

let painted = false;
let armed = false;
const listeners = new Set<() => void>();

function markPainted() {
  if (painted) return;
  painted = true;
  for (const listener of [...listeners]) listener();
}

function arm() {
  if (armed || typeof window === "undefined") return;
  armed = true;
  try {
    if (performance.getEntriesByName("first-contentful-paint").length > 0) {
      // Already painted (a client-side navigation, or a late-mounted
      // component). React re-reads the snapshot right after subscribing.
      painted = true;
      return;
    }
    const observer = new PerformanceObserver((list) => {
      if (list.getEntries().some((e) => e.name === "first-contentful-paint")) {
        observer.disconnect();
        markPainted();
      }
    });
    observer.observe({ type: "paint", buffered: true });
  } catch {
    // No Paint Timing support: the timer below is the only signal.
  }
  window.setTimeout(markPainted, FIRST_PAINT_FALLBACK_MS);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  arm();
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => painted;
const getServerSnapshot = () => false;

export function useAfterFirstPaint(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Test seam: forget the shared state between cases. */
export function resetFirstPaintForTests() {
  painted = false;
  armed = false;
  listeners.clear();
}
