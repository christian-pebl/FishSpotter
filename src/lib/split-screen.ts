"use client";

/**
 * The split screen contract.
 *
 * The feed is a two-up layout, not a stack of floating cards. One half is
 * ALWAYS the clip; the other half is whatever the app currently wants to say
 * about it (the rung tiles, a side-by-side comparison, a species card, the
 * reveal). On a wide viewport the working half is docked to the left and the
 * clip is resized into what is left; on a phone the working half is a bottom
 * sheet and the clip sits above it.
 *
 * Before this module the geometry lived inside `TileGate` and was broadcast as
 * a bare `fs-gate` CustomEvent that only `FeedCard` and `FeedPlayer` listened
 * to. That was enough for the rungs and nothing else, so every other surface
 * (the comparison, the species card, the reveal, the map) stayed a full-screen
 * `fixed inset-0` overlay: it dimmed the clip, straddled the seam, and threw
 * away the split the moment the user needed it most, i.e. while deciding which
 * of two animals they were actually looking at.
 *
 * Three things live here so every surface can be a split citizen:
 *
 *  1. The sizing constants + the stored user size, so a panel opened by one
 *     component is the same size as the panel opened by the next one. The
 *     width the viewer dragged on the tiles is the width the reveal inherits.
 *  2. `publishSplitFrame` / `useSplitFrame`, an event bus with a CACHED
 *     snapshot. The cache is the load-bearing part: an overlay that mounts
 *     mid-flow (a comparison opened from an already-open panel) would
 *     otherwise see nothing until the next resize and would render full
 *     screen for its whole life.
 *  3. `--fs-panel-*` custom properties on the document element, so overlays
 *     PORTALED to `document.body` can sit exactly over the working half in
 *     pure CSS. They are REMOVED (never zeroed) when no split is open, so
 *     `var(--fs-panel-w, 100vw)` falls back to the old full-screen geometry
 *     with no extra branching at the call site.
 */

import { useCallback, useEffect, useRef, useState } from "react";

/** Window event name. Kept as the historic string so nothing else has to move. */
export const SPLIT_EVENT = "fs-gate";

export type SplitFrame =
  | { open: false; docked?: boolean; widthPct?: number; heightPct?: number }
  | { open: true; docked: boolean; widthPct: number; heightPct: number };

/* ------------------------------------------------------------------ sizing */

/** Wide enough to put the panel BESIDE the clip rather than under it. */
export const DOCK_MEDIA_QUERY = "(min-width: 768px)";

export const MIN_WIDTH_PCT = 28;
export const MAX_WIDTH_PCT = 50;
/**
 * Roughly a third of a wide screen: enough for a 3-column tile grid, and it
 * leaves the clip the larger share. The user can widen it to half.
 */
export const DEFAULT_WIDTH_PCT = 36;
export const MIN_WIDTH_REM = 20;
export const WIDTH_STORAGE_KEY = "fs-gate-width-pct";

/**
 * Phone sizing. A phone has no room to put the panel beside the clip, so it
 * goes UNDER it: a 50/50 split, video on top, options below. Low enough to
 * uncover most of the clip, high enough that a tile grid is still a grid at
 * the bottom of the range rather than a clipped sliver.
 */
export const MIN_HEIGHT_PCT = 34;
export const MAX_HEIGHT_PCT = 92;
/**
 * 56, not the round 50, and the number is a measurement (30 Aug 2026).
 *
 * At 50% a 375x812 phone gave the tile grid 197px of scroll viewport, and two
 * rows of species tiles need 214px (229px when both rows carry a name that
 * wraps). So the default sheet could show exactly ONE row of candidates, and
 * the rung whose entire job is comparing species showed one species at a time
 * unless the user thought to drag the sheet up.
 *
 * The chrome is not where the rest of it comes from: back, close, "compare
 * side by side", "none look right" and the like are all pinned at the 44px
 * touch-target floor, so trimming them below that would buy pixels by making
 * the panel harder to use. 56% clears two rows with ~30px to spare and still
 * leaves the clip more than half the screen.
 */
export const DEFAULT_HEIGHT_PCT = 56;
/** Below this a sheet reflows denser rather than clipping its first row. */
export const COMPACT_HEIGHT_PCT = 46;
export const HEIGHT_STORAGE_KEY = "fs-gate-height-pct";

export const clampWidthPct = (v: number) =>
  Math.min(MAX_WIDTH_PCT, Math.max(MIN_WIDTH_PCT, v));

export const clampHeightPct = (v: number) =>
  Math.min(MAX_HEIGHT_PCT, Math.max(MIN_HEIGHT_PCT, v));

export const readStoredPct = (key: string, fallback: number) => {
  try {
    const stored = Number(window.localStorage.getItem(key));
    return Number.isFinite(stored) && stored > 0 ? stored : fallback;
  } catch {
    return fallback; // storage unavailable (private window, blocked site data)
  }
};

export const writeStoredPct = (key: string, value: number) => {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    /* storage unavailable, so the size still applies only for this session */
  }
};

/** True on a wide viewport. SSR-safe (false first paint, corrected on mount),
 *  and live: dragging a desktop window narrow re-flows back to the sheet. */
export function useDocked(): boolean {
  const [docked, setDocked] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(DOCK_MEDIA_QUERY);
    const sync = () => setDocked(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return docked;
}

/** The viewer's last panel size, restored once on mount. Both axes are read
 *  together so a phone that later rotates to a tablet width already has the
 *  width the viewer set on desktop. */
export function useStoredSplitSize() {
  const [widthPct, setWidthPct] = useState(DEFAULT_WIDTH_PCT);
  const [heightPct, setHeightPct] = useState(DEFAULT_HEIGHT_PCT);
  useEffect(() => {
    setWidthPct(clampWidthPct(readStoredPct(WIDTH_STORAGE_KEY, DEFAULT_WIDTH_PCT)));
    setHeightPct(clampHeightPct(readStoredPct(HEIGHT_STORAGE_KEY, DEFAULT_HEIGHT_PCT)));
  }, []);
  return { widthPct, setWidthPct, heightPct, setHeightPct };
}

/* -------------------------------------------------------------- the frame */

const CLOSED: SplitFrame = { open: false };
let current: SplitFrame = CLOSED;

/** The split as it stands RIGHT NOW. Safe to call during render; this is how a
 *  late-mounting overlay learns it opened into an already-split screen. */
export function getSplitFrame(): SplitFrame {
  return current;
}

/**
 * Announce the space the working half is taking. Re-fired on every frame of a
 * resize drag, so keep listeners cheap (`FeedCard` writes a custom property
 * rather than setting React state, deliberately).
 */
export function publishSplitFrame(next: SplitFrame): void {
  if (typeof window === "undefined") return;
  current = next.open ? next : CLOSED;
  window.dispatchEvent(new CustomEvent<SplitFrame>(SPLIT_EVENT, { detail: current }));
}

export function subscribeSplitFrame(fn: (f: SplitFrame) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => fn((e as CustomEvent<SplitFrame>).detail ?? CLOSED);
  window.addEventListener(SPLIT_EVENT, listener);
  return () => window.removeEventListener(SPLIT_EVENT, listener);
}

/** Subscribing read of the split, seeded from the cached snapshot so an
 *  overlay is correctly laid out on its FIRST paint, not one event later. */
export function useSplitFrame(): SplitFrame {
  const [frame, setFrame] = useState<SplitFrame>(CLOSED);
  useEffect(() => {
    setFrame(getSplitFrame());
    return subscribeSplitFrame(setFrame);
  }, []);
  return frame;
}

/* ------------------------------------------------- the panel rect, in CSS */

const PANEL_VARS = ["--fs-panel-x", "--fs-panel-y", "--fs-panel-w", "--fs-panel-h"] as const;

/**
 * Mirror the working half's viewport rect onto the document element so a
 * PORTALED overlay can occupy it without knowing anything about the feed's
 * DOM. Pass null to clear it.
 *
 * Cleared by REMOVING the properties, never by writing zeroes: overlays lean
 * on `var(--fs-panel-w, 100vw)` to fall back to full screen when no split is
 * open, and a `0px` value would satisfy the var and collapse them instead.
 */
export function publishPanelRect(el: HTMLElement | null): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!el) {
    for (const v of PANEL_VARS) root.style.removeProperty(v);
    return;
  }
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) {
    for (const v of PANEL_VARS) root.style.removeProperty(v);
    return;
  }
  root.style.setProperty("--fs-panel-x", `${Math.round(r.left)}px`);
  root.style.setProperty("--fs-panel-y", `${Math.round(r.top)}px`);
  root.style.setProperty("--fs-panel-w", `${Math.round(r.width)}px`);
  root.style.setProperty("--fs-panel-h", `${Math.round(r.height)}px`);
}

/**
 * Position a `fixed` overlay over the working half, falling back to the whole
 * viewport when nothing is split. Spread onto the OUTER element (the one that
 * paints the scrim), so the scrim dims the working half only and the clip half
 * stays bright and watchable, which is the entire point of the split.
 */
export const PANEL_FRAME_STYLE: React.CSSProperties = {
  position: "fixed",
  left: "var(--fs-panel-x, 0px)",
  top: "var(--fs-panel-y, 0px)",
  width: "var(--fs-panel-w, 100vw)",
  height: "var(--fs-panel-h, 100dvh)",
};

/**
 * Keep the frame + the CSS rect in step with a panel element for as long as it
 * is on screen. `open` false publishes a closed frame (the clip goes back to
 * full bleed) without unmounting the caller, which is what a minimised gate
 * needs.
 */
export function useSplitPanel(
  ref: React.RefObject<HTMLElement | null>,
  frame: SplitFrame,
): void {
  const { open } = frame;
  const docked = frame.open ? frame.docked : undefined;
  const widthPct = frame.open ? frame.widthPct : undefined;
  const heightPct = frame.open ? frame.heightPct : undefined;

  useEffect(() => {
    publishSplitFrame(
      open
        ? { open: true, docked: !!docked, widthPct: widthPct ?? 0, heightPct: heightPct ?? 0 }
        : { open: false },
    );
  }, [open, docked, widthPct, heightPct]);

  useEffect(() => {
    const el = ref.current;
    if (!open || !el) {
      publishPanelRect(null);
      return;
    }

    // A ResizeObserver alone is NOT enough, and the miss is silent: the panel
    // enters on a framer-motion transform (y: 12 -> 0), which MOVES it without
    // ever changing its size, so the observer never fires again and the rect
    // stays 12px stale for the panel's whole life. An overlay laid out on that
    // rect sits 12px low and leaks a strip of the panel beneath it.
    //
    // So: re-measure per frame until the box holds still, then stop. Idle cost
    // is zero, and any later move (a resize drag, rotation) restarts it.
    let raf = 0;
    let lastKey = "";
    let stable = 0;
    const measure = () => {
      const node = ref.current;
      if (!node) return;
      const r = node.getBoundingClientRect();
      const key = `${r.left}|${r.top}|${r.width}|${r.height}`;
      if (key === lastKey) {
        stable += 1;
      } else {
        lastKey = key;
        stable = 0;
        publishPanelRect(node);
      }
      // ~8 still frames is well past any of our transitions without leaving a
      // rAF loop running behind an idle panel.
      if (stable < 8) raf = requestAnimationFrame(measure);
    };
    const settle = () => {
      stable = 0;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    settle();

    const ro = new ResizeObserver(settle);
    ro.observe(el);
    window.addEventListener("resize", settle);
    window.addEventListener("scroll", settle, true);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", settle);
      window.removeEventListener("scroll", settle, true);
    };
  }, [ref, open, docked, widthPct, heightPct]);

  // Belt and braces: a component can unmount without ever setting open=false
  // (route change, a clip scrolled out of the feed). Leaving stale vars behind
  // would strand the NEXT overlay over a panel that is no longer there.
  useEffect(
    () => () => {
      publishSplitFrame({ open: false });
      publishPanelRect(null);
    },
    [],
  );
}

/* ------------------------------------------------------------- resizing */

/**
 * The one resize gesture, on whichever axis the split is using: a docked panel
 * drags its seam edge (width), a sheet drags its top grip (height). Live while
 * the finger is down, banked to localStorage on release.
 *
 * Shared rather than reimplemented per surface, because the size is shared: a
 * viewer who widens the tiles expects the reveal that follows to be that wide,
 * and two copies of this arithmetic would drift the moment one is touched.
 */
export function useSplitResize({
  docked,
  widthPct,
  heightPct,
  setWidthPct,
  setHeightPct,
  panelRef,
  trackRef,
}: {
  docked: boolean;
  widthPct: number;
  heightPct: number;
  setWidthPct: (v: number) => void;
  setHeightPct: (v: number) => void;
  panelRef: React.RefObject<HTMLElement | null>;
  trackRef: React.RefObject<HTMLElement | null>;
}) {
  const [resizing, setResizing] = useState(false);
  const widthRef = useRef(widthPct);
  widthRef.current = widthPct;
  const heightRef = useRef(heightPct);
  heightRef.current = heightPct;

  const startResize = useCallback(
    (e: React.PointerEvent) => {
      const card = panelRef.current;
      const track = trackRef.current;
      if (!card || !track) return;
      e.preventDefault();
      const cardRect = card.getBoundingClientRect();
      const trackRect = track.getBoundingClientRect();
      if (trackRect.width <= 0 || trackRect.height <= 0) return;
      setResizing(true);

      // Banked here rather than read back off the state ref on release: a flick
      // where the last move and the release land in the same frame would persist
      // the pre-drag value, because React has not re-rendered the ref yet.
      let latest = docked ? widthRef.current : heightRef.current;

      const onMove = (ev: PointerEvent) => {
        if (docked) {
          latest = clampWidthPct(((ev.clientX - cardRect.left) / trackRect.width) * 100);
          setWidthPct(latest);
        } else {
          // Bottom-anchored: the sheet grows upward, so its height is the gap
          // between the pointer and the sheet's (fixed) bottom edge.
          latest = clampHeightPct(((cardRect.bottom - ev.clientY) / trackRect.height) * 100);
          setHeightPct(latest);
        }
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        setResizing(false);
        writeStoredPct(docked ? WIDTH_STORAGE_KEY : HEIGHT_STORAGE_KEY, latest);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [docked, panelRef, trackRef, setWidthPct, setHeightPct],
  );

  /** A pointer drag must never be the only way to work a control (WCAG 2.1.1).
   *  Arrows step 2%, Home/End snap to the bounds. */
  const onResizeKey = useCallback(
    (e: React.KeyboardEvent) => {
      const [less, more] = docked ? ["ArrowLeft", "ArrowRight"] : ["ArrowDown", "ArrowUp"];
      const currentPct = docked ? widthRef.current : heightRef.current;
      const min = docked ? MIN_WIDTH_PCT : MIN_HEIGHT_PCT;
      const max = docked ? MAX_WIDTH_PCT : MAX_HEIGHT_PCT;
      let next: number | null = null;
      if (e.key === less) next = currentPct - 2;
      else if (e.key === more) next = currentPct + 2;
      else if (e.key === "Home") next = min;
      else if (e.key === "End") next = max;
      if (next === null) return;
      e.preventDefault();
      if (docked) {
        const v = clampWidthPct(next);
        setWidthPct(v);
        writeStoredPct(WIDTH_STORAGE_KEY, v);
      } else {
        const v = clampHeightPct(next);
        setHeightPct(v);
        writeStoredPct(HEIGHT_STORAGE_KEY, v);
      }
    },
    [docked, setWidthPct, setHeightPct],
  );

  return { resizing, startResize, onResizeKey };
}
