"use client";

import { useEffect, useRef, useState } from "react";

export type AnchorRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

/** The `data-tour` value that actually resolved, plus its viewport rect. */
export type AnchorMatch = { key: string; rect: AnchorRect };

/**
 * How often the anchor is re-measured while the tour is up.
 *
 * Deliberately an interval and NOT requestAnimationFrame. rAF was the first
 * implementation and it was wrong twice over: it committed React state up to
 * 60 times a second for an overlay whose own travel is eased over 300ms (so
 * every extra sample was invisible), and it stops dead whenever the tab is not
 * compositing, which left the spotlight frozen or blank with no way to recover.
 * At 12Hz the measurement is cheap, survives a backgrounded tab, and is still
 * far faster than the framer transition that consumes it, so tracking a live
 * panel drag looks identical.
 */
const MEASURE_MS = 80;

const sameRect = (a: AnchorRect | null, b: AnchorRect | null) =>
  a === b ||
  (!!a &&
    !!b &&
    Math.round(a.top) === Math.round(b.top) &&
    Math.round(a.left) === Math.round(b.left) &&
    Math.round(a.width) === Math.round(b.width) &&
    Math.round(a.height) === Math.round(b.height));

/** Poll `read` while `active`, committing state only when the value changes. */
function usePolledMeasure<T>(
  read: () => T | null,
  isEqual: (a: T | null, b: T | null) => boolean,
  active: boolean,
  deps: string,
): T | null {
  const [value, setValue] = useState<T | null>(null);
  const readRef = useRef(read);
  readRef.current = read;
  const equalRef = useRef(isEqual);
  equalRef.current = isEqual;

  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    let last: T | null = null;
    const measure = () => {
      const next = readRef.current();
      if (equalRef.current(next, last)) return;
      last = next;
      setValue(next);
    };
    measure(); // Never wait a tick to light the first anchor.
    const timer = window.setInterval(measure, MEASURE_MS);
    // A resize relays out everything at once; do not make the user wait 80ms.
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", measure);
    };
    // `deps` is a serialised key: the caller passes a fresh array literal every
    // render, so depending on it directly would resubscribe forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps, active]);

  // Clearing on deactivate lives here rather than in the effect above, so the
  // effect has exactly one job and cannot set state on a path that also returns
  // no cleanup.
  useEffect(() => {
    if (!active) setValue(null);
  }, [active]);

  return value;
}

function measureAnchor(key: string): AnchorRect | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${key}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  // A zero-area rect means the element is mounted but not laid out yet (a gate
  // mid-enter, an image still loading). Treat it as absent so the spotlight
  // does not snap to a point and then jump.
  if (r.width < 2 || r.height < 2) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * Live viewport rect for the first `[data-tour="..."]` element that exists,
 * from a priority-ordered list of keys.
 */
export function useAnchorRect(keys: readonly string[], active: boolean): AnchorMatch | null {
  const keyList = keys.join("|");
  return usePolledMeasure<AnchorMatch>(
    () => {
      for (const key of keyList.split("|")) {
        if (!key) continue;
        const rect = measureAnchor(key);
        if (rect) return { key, rect };
      }
      return null;
    },
    (a, b) => a?.key === b?.key && sameRect(a?.rect ?? null, b?.rect ?? null),
    active,
    keyList,
  );
}

/**
 * Centre point of a specific tile inside the current gate, used to aim the
 * ghost cursor at the tile the tour is suggesting ("tap Crab"). Returns null
 * when that tile is not on screen, and the caller falls back to the anchor
 * centre, so a clip whose animal is not a crab never gets a cursor pointing at
 * a tile that would be the wrong answer.
 */
export function useTileCentre(
  tile: string | undefined,
  active: boolean,
): { x: number; y: number } | null {
  return usePolledMeasure<{ x: number; y: number }>(
    () => {
      if (!tile) return null;
      const el = document.querySelector<HTMLElement>(`[data-tour-tile="${tile}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return null;
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },
    (a, b) =>
      Math.round(a?.x ?? -1) === Math.round(b?.x ?? -1) &&
      Math.round(a?.y ?? -1) === Math.round(b?.y ?? -1),
    active && !!tile,
    tile ?? "",
  );
}
