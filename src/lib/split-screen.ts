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
 *  3. Custom properties on the document element, so the clip frame and any
 *     overlay PORTALED to `document.body` can sit exactly against the working
 *     half in pure CSS: `--gate-left` / `--gate-bottom` are the inset the clip
 *     gives up, `--fs-panel-*` is the panel's measured rect. They are REMOVED
 *     (never zeroed) when no split is open, so `var(--fs-panel-w, 100vw)` and
 *     `var(--gate-left, 0px)` fall back to the full-screen geometry with no
 *     extra branching at the call site.
 *
 * FIRST-RENDER CORRECTNESS (7 Sep 2026). Everything a component reads from
 * here is right on its FIRST render, not one effect later. `useDocked` and
 * `useStoredSplitSize` used to start from a placeholder (`false`, the default
 * size) and correct themselves in a mount effect, which is the textbook
 * hydration-safe pattern and also a flash: the gate opened as a phone sheet on
 * every laptop and landscape tablet, painted two or three frames with the clip
 * squashed into the top half, then jumped to the docked layout, and the
 * viewer's own panel width arrived a frame after that. All of it is
 * `useSyncExternalStore` now: the server and the hydrating client still see the
 * placeholder (so the HTML never mismatches), but a panel that mounts on a tap
 * reads the real viewport and the real stored size straight away. The frame is
 * published from a LAYOUT effect for the same reason: the clip shrinks in the
 * same frame the panel appears, rather than one paint later.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { useMediaQuery } from "@/lib/useMediaQuery";

/** Window event name. Kept as the historic string so nothing else has to move. */
export const SPLIT_EVENT = "fs-gate";

export type SplitFrame =
  | { open: false; docked?: boolean; widthPct?: number; heightPct?: number }
  | { open: true; docked: boolean; widthPct: number; heightPct: number };

// `useLayoutEffect` is a no-op on the server but React 18 still warns about
// it there; this is the usual isomorphic alias (framer-motion does the same).
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

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

/**
 * True on a wide viewport. Right on the first render of anything mounted after
 * hydration (a panel opened by a tap), false on the server and while hydrating
 * (matching the HTML), and live: dragging a desktop window narrow re-flows
 * back to the sheet. See `useMediaQuery` for the mechanism.
 */
export function useDocked(): boolean {
  return useMediaQuery(DOCK_MEDIA_QUERY);
}

/* -------------------------------------------------- the stored panel size */

type SplitSize = { widthPct: number; heightPct: number };

const DEFAULT_SIZE: SplitSize = Object.freeze({
  widthPct: DEFAULT_WIDTH_PCT,
  heightPct: DEFAULT_HEIGHT_PCT,
});

// One in-memory copy for the whole app, read from localStorage the first time
// anyone asks. Both axes live together so a phone that later rotates to a
// tablet width already has the width the viewer set on desktop.
let splitSize: SplitSize | null = null;
const sizeListeners = new Set<() => void>();

function readSplitSize(): SplitSize {
  if (splitSize) return splitSize;
  if (typeof window === "undefined") return DEFAULT_SIZE;
  splitSize = {
    widthPct: clampWidthPct(readStoredPct(WIDTH_STORAGE_KEY, DEFAULT_WIDTH_PCT)),
    heightPct: clampHeightPct(readStoredPct(HEIGHT_STORAGE_KEY, DEFAULT_HEIGHT_PCT)),
  };
  return splitSize;
}

function setSplitSize(patch: Partial<SplitSize>): void {
  const current = readSplitSize();
  const next: SplitSize = {
    widthPct: patch.widthPct ?? current.widthPct,
    heightPct: patch.heightPct ?? current.heightPct,
  };
  if (next.widthPct === current.widthPct && next.heightPct === current.heightPct) return;
  splitSize = next;
  sizeListeners.forEach((fn) => fn());
}

const subscribeSplitSize = (fn: () => void) => {
  sizeListeners.add(fn);
  return () => {
    sizeListeners.delete(fn);
  };
};
const getDefaultSize = () => DEFAULT_SIZE;

/** Forget the cached size so the next read hits localStorage again. Tests only. */
export function resetSplitSizeCache(): void {
  splitSize = null;
}

/**
 * The viewer's panel size: their last drag, or the defaults. Shared across
 * every panel, so the width dragged on the tiles is the width the reveal that
 * follows opens at, and available on the FIRST render of a panel mounted after
 * hydration (a stored 48% used to open at 36% and jump). Setting it re-renders
 * every mounted panel, which is the point; banking it to localStorage is still
 * the caller's job (`writeStoredPct`, on release rather than per frame).
 */
export function useStoredSplitSize() {
  const size = useSyncExternalStore(subscribeSplitSize, readSplitSize, getDefaultSize);
  const setWidthPct = useCallback((v: number) => setSplitSize({ widthPct: v }), []);
  const setHeightPct = useCallback((v: number) => setSplitSize({ heightPct: v }), []);
  return { widthPct: size.widthPct, setWidthPct, heightPct: size.heightPct, setHeightPct };
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
 * The inset the clip frame gives up to the working half, as custom properties
 * on the document element. Every feed card's frame reads them through plain
 * inheritance (`left: var(--gate-left, 0px)`, `bottom: var(--gate-bottom,
 * 3.5rem)`), so one write here re-flows every card with no listener and no
 * React render in any of them. It used to be one window listener PER CARD
 * (139 on a full feed) each writing the same two properties onto its own
 * article, on every frame of a resize drag.
 *
 * The percentage is the estimate; the measured panel (`publishPanelRect`) then
 * overwrites it with the real pixel width or height, which also covers the
 * docked panel's minimum width: at 768px wide, 36% is narrower than the 20rem
 * floor the panel enforces, and an inset from the percentage alone left the
 * panel lying over the edge of the clip.
 *
 * Removed, never zeroed, when the split closes: the fallbacks restore the
 * full-bleed frame and a `0px` bottom would eat the docked identify bar.
 */
function applyGateInset(frame: SplitFrame): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement.style;
  if (!frame.open) {
    root.removeProperty("--gate-left");
    root.removeProperty("--gate-bottom");
    return;
  }
  if (frame.docked) {
    root.setProperty("--gate-left", `${frame.widthPct}%`);
    root.removeProperty("--gate-bottom");
  } else {
    root.setProperty("--gate-bottom", `${frame.heightPct}%`);
    root.removeProperty("--gate-left");
  }
}

/**
 * Announce the space the working half is taking. Re-fired on every frame of a
 * resize drag, so keep listeners cheap: subscribe to the one field you need
 * (`useSplitOpen`, `useSplitDocked`) rather than the whole frame, and the
 * feed's cards do not subscribe at all (see `applyGateInset`).
 */
export function publishSplitFrame(next: SplitFrame): void {
  if (typeof window === "undefined") return;
  current = next.open ? next : CLOSED;
  applyGateInset(current);
  window.dispatchEvent(new CustomEvent<SplitFrame>(SPLIT_EVENT, { detail: current }));
}

export function subscribeSplitFrame(fn: (f: SplitFrame) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => fn((e as CustomEvent<SplitFrame>).detail ?? CLOSED);
  window.addEventListener(SPLIT_EVENT, listener);
  return () => window.removeEventListener(SPLIT_EVENT, listener);
}

const getClosed = () => CLOSED;
const getFalse = () => false;
const getSplitOpen = () => current.open;
const getSplitDocked = () => current.open && current.docked;

/** Subscribing read of the whole split, seeded from the cached snapshot so an
 *  overlay is correctly laid out on its FIRST render. Re-renders the caller on
 *  every frame of a resize drag, so prefer the boolean selectors below unless
 *  the caller really needs the numbers. */
export function useSplitFrame(): SplitFrame {
  return useSyncExternalStore(subscribeSplitFrame, getSplitFrame, getClosed);
}

/** Is any working half up? Re-renders only when the answer changes. */
export function useSplitOpen(): boolean {
  return useSyncExternalStore(subscribeSplitFrame, getSplitOpen, getFalse);
}

/** Is the working half docked beside the clip (as opposed to closed, or a
 *  sheet under it)? Re-renders only when the answer changes. */
export function useSplitDocked(): boolean {
  return useSyncExternalStore(subscribeSplitFrame, getSplitDocked, getFalse);
}

/* ------------------------------------------------- the panel rect, in CSS */

const PANEL_VARS = ["--fs-panel-x", "--fs-panel-y", "--fs-panel-w", "--fs-panel-h"] as const;

/**
 * Mirror the working half's viewport rect onto the document element so a
 * PORTALED overlay can occupy it without knowing anything about the feed's
 * DOM. Pass null to clear it. With `axis` given, the clip inset is set from
 * the same measurement (see `applyGateInset`).
 *
 * Cleared by REMOVING the properties, never by writing zeroes: overlays lean
 * on `var(--fs-panel-w, 100vw)` to fall back to full screen when no split is
 * open, and a `0px` value would satisfy the var and collapse them instead.
 */
export function publishPanelRect(el: HTMLElement | null, axis?: "docked" | "sheet"): void {
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
  if (axis === "docked") root.style.setProperty("--gate-left", `${Math.round(r.width)}px`);
  else if (axis === "sheet") root.style.setProperty("--gate-bottom", `${Math.round(r.height)}px`);
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
 *
 * Both effects are LAYOUT effects: the frame is published, and the panel first
 * measured, before the browser paints the render that mounted it, so the clip
 * is already resized in the frame the panel first appears in.
 */
export function useSplitPanel(
  ref: React.RefObject<HTMLElement | null>,
  frame: SplitFrame,
): void {
  const { open } = frame;
  const docked = frame.open ? frame.docked : undefined;
  const widthPct = frame.open ? frame.widthPct : undefined;
  const heightPct = frame.open ? frame.heightPct : undefined;

  useIsomorphicLayoutEffect(() => {
    publishSplitFrame(
      open
        ? { open: true, docked: !!docked, widthPct: widthPct ?? 0, heightPct: heightPct ?? 0 }
        : { open: false },
    );
  }, [open, docked, widthPct, heightPct]);

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!open || !el) {
      publishPanelRect(null);
      return;
    }
    const axis = docked ? "docked" : "sheet";

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
        publishPanelRect(node, axis);
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
    // Synchronous first measurement, so the very first paint has the real rect
    // (and the real pixel inset for the clip); the loop then tracks the entry
    // animation from the next frame.
    measure();

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
