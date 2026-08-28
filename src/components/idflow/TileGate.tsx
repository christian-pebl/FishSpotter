"use client";

/**
 * TileGate, the reusable "Spot It" gate chrome.
 *
 * Shared by Rung 1 (shape class), Rung 2 (body shape) and Rung 3 (CandidateGate
 * species photo grid). It owns:
 *   - the non-covering floating card (clip keeps playing/visible behind it),
 *   - drag-from-the-grip-handle only (so tiles stay tappable),
 *   - the modal a11y (focus grab, Escape, Tab trap, body-scroll lock, focus
 *     restore),
 *   - a "Hide" affordance back to the video, an optional "Back" affordance to
 *     the previous rung, and an optional breadcrumb of prior picks,
 *   - a tile grid (scrolls when it overflows) + an optional Not-sure / Skip footer.
 *
 * Each tile is a select button. The visual is either a small centered `icon`
 * (silhouette rungs) or a full-width square `media` node (Rung-3 photos), with
 * the `label` below and an optional count `badge`. An optional `extra` node
 * renders beneath the button (legacy grid use).
 *
 * `variant="list"` (Rung 2) lays tiles out as full-width rows with a 2x
 * silhouette and a per-row chevron that drops an inline `renderExpanded` panel
 * (the body-form examples) directly below that row. Single-open accordion: only
 * one row's panel is mounted at a time, so we never fire N photo fetches at
 * once. `variant="grid"` (default, Rung 1 + Rung 3) is unchanged.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { DURATION, EASE } from "@/lib/motion";

/** A teal-tinted silhouette from a static SVG, via CSS mask + bg-current (zero
 * JS-bundle cost, hover-recolours with the tile). Shared by all rungs. */
export function MaskSilhouette({ src }: { src: string }) {
  return (
    <span
      aria-hidden="true"
      className="block h-full w-full bg-current"
      style={{
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        maskSize: "contain",
        WebkitMaskSize: "contain",
      }}
    />
  );
}

export type TileSpec = {
  key: string;
  label: string;
  disabled?: boolean;
  /** Count badge (top-right). Omit or 0 to hide. */
  badge?: number;
  /** Small centered silhouette node (silhouette rungs). Rendered in an 8×8 area
   * unless `media` is set. */
  icon?: React.ReactNode;
  /** Full-width square media (Rung-3 photos / silhouette fallback). Takes
   * precedence over `icon`. */
  media?: React.ReactNode;
  /** Optional node under the select button (legacy grid use). */
  extra?: React.ReactNode;
  /** List variant only: lazily-rendered panel shown inline below the row when
   * its chevron is expanded. Only the open row calls this, so its content
   * (e.g. a SpeciesGallery) mounts on demand. Presence adds the chevron. */
  renderExpanded?: () => React.ReactNode;
  ariaLabel?: string;
};

export type Crumb = { label: string; onClick?: () => void };

/**
 * Desktop docking (28 Aug 2026). On a wide screen the gate no longer floats
 * centred over the clip. It docks to the LEFT edge, full height, capped at half
 * the width, so the video keeps playing (and stays watchable) beside it rather
 * than underneath it. The user can drag the panel's right edge to resize; the
 * width persists across clips and sessions.
 *
 * MAX_WIDTH_PCT is the load-bearing number: it is what guarantees "at least half
 * the clip is always visible", so raising it defeats the point of docking.
 * MIN_WIDTH_REM keeps a 3-column tile grid legible on a narrow laptop.
 *
 * Below the breakpoint (phones, the primary surface) nothing changes: the card
 * stays the centred, draggable, bottom-anchored sheet it already was.
 */
const DOCK_MEDIA_QUERY = "(min-width: 768px)";
const MIN_WIDTH_PCT = 28;
const MAX_WIDTH_PCT = 50;
// Roughly a third of a wide screen by default: enough for a 3-column tile grid,
// and it leaves the clip the larger share. The user can widen it to half.
const DEFAULT_WIDTH_PCT = 36;
const MIN_WIDTH_REM = 20;
const WIDTH_STORAGE_KEY = "fs-gate-width-pct";

/**
 * Phone sizing (28 Aug 2026). A phone has no room to put the panel beside the
 * clip, so it goes UNDER it: a 50/50 split, video on top, options below. The
 * sheet is anchored to the bottom and sized by its top grip. Drag the grip and
 * the split moves live, let go and it stays. Below COMPACT_HEIGHT_PCT the tile
 * grid reflows denser so a short sheet still shows whole tiles rather than a
 * sliver of the first row.
 *
 * The other half of the deal is the "Full video" button on the sheet's top
 * edge: one tap drops the sheet to the dock bubble so the clip plays full
 * screen, and the bubble brings it back with the rung intact. Between them, a
 * phone user never has to choose between watching and identifying.
 *
 * This replaces the old free-drag-the-card-around behaviour, which moved the
 * card without ever giving back any space.
 */
// Low enough to uncover most of the clip, high enough that the tile grid is
// still a grid at the bottom of the range rather than a clipped sliver. Going
// all the way to "no panel" is the Full video button's job, not the grip's.
const MIN_HEIGHT_PCT = 34;
const MAX_HEIGHT_PCT = 92;
// A straight 50/50 split by default: clip on top, options underneath. Both
// halves are then always live, so you can watch the animal and read the tiles
// without moving anything, and the grip re-balances it from there.
const DEFAULT_HEIGHT_PCT = 50;
const COMPACT_HEIGHT_PCT = 46;
const HEIGHT_STORAGE_KEY = "fs-gate-height-pct";

const clampWidthPct = (v: number) =>
  Math.min(MAX_WIDTH_PCT, Math.max(MIN_WIDTH_PCT, v));

const clampHeightPct = (v: number) =>
  Math.min(MAX_HEIGHT_PCT, Math.max(MIN_HEIGHT_PCT, v));

const readStoredPct = (key: string, fallback: number) => {
  try {
    const stored = Number(window.localStorage.getItem(key));
    return Number.isFinite(stored) && stored > 0 ? stored : fallback;
  } catch {
    return fallback; // storage unavailable (private window, blocked site data)
  }
};

const writeStoredPct = (key: string, value: number) => {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    /* storage unavailable, so the size still applies only for this session */
  }
};

/** True on a wide viewport. SSR-safe (false first paint, corrected on mount),
 *  and live: dragging a desktop window narrow re-flows back to the sheet. */
function useDocked(): boolean {
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

export function TileGate({
  ariaLabel,
  title,
  tiles,
  columns = 4,
  variant = "grid",
  onSelect,
  onClose,
  onBack,
  breadcrumb,
  notSure,
  skip,
  coarse,
  compare,
  emptyMessage,
  onRuleOut,
  ruledOut,
  suspendKeyboard = false,
  bubbleLabel = "Reopen the selector",
}: {
  ariaLabel: string;
  title: string;
  tiles: TileSpec[];
  columns?: number;
  /** "grid" (default, Rung 1 + Rung 3) or "list" (Rung 2 accordion). */
  variant?: "grid" | "list";
  onSelect: (key: string) => void;
  onClose: () => void;
  /** Optional "Back" to the previous rung (top-left). Omit on Rung 1. */
  onBack?: () => void;
  /** Prior picks, newest last; each can jump back to its rung. */
  breadcrumb?: Crumb[];
  /** The "can't call it" escape hatch. `prominent` renders it as a full-width
   *  outline button above the footer instead of the small footer text link,
   *  used by Rungs 1 + 2, where it no longer reads as a dead end ("Not sure")
   *  but as the action it actually performs ("Not sure? Compare all 33 fish"),
   *  landing on the whole-bucket photo grid. */
  notSure?: { label: string; onClick: () => void; prominent?: boolean };
  skip?: { label: string; onClick: () => void };
  /** A primary "submit the coarse shape class" action ("It's just a Fish"),
   *  rendered as a full-width button above the notSure/skip row. Lets a user
   *  who can't get to species commit the shape class for partial credit. */
  coarse?: { label: string; onClick: () => void };
  /** A secondary "compare these look-alikes side by side" action, rendered as a
   *  full-width outline button below the grid (Rung-3 / class-level confusion
   *  groups). Opens the simplified SpeciesComparison (big photos + bullet cues). */
  compare?: { label: string; onClick: () => void };
  /** Grid variant only. When set, every tile gets a corner control that
   *  eliminates it from the grid ("rule out"), the working move of a real
   *  identification: narrow by removing what it clearly is not. Purely a view
   *  filter, the caller owns the state. Omit to get the plain grid. */
  onRuleOut?: (key: string) => void;
  /** The eliminated tiles, surfaced under the grid so the set is never a dead
   *  end: a count that expands into the individual names, each restorable, plus
   *  a restore-all. Rendered in the pinned footer rather than inside the scroll
   *  area so it survives the case where everything has been ruled out and the
   *  grid is replaced by `emptyMessage`. */
  ruledOut?: {
    items: { key: string; label: string }[];
    onRestore: (key: string) => void;
    onRestoreAll: () => void;
  };
  /** Shown instead of the grid when there are no tiles. */
  emptyMessage?: string;
  /** When true (an Examples popup is open on top), the gate yields keyboard
   * control so it can't fight the popup's focus trap, and goes inert. */
  suspendKeyboard?: boolean;
  /** Accessible label for the minimized dock bubble (per-rung wording). */
  bubbleLabel?: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  // Minimized to the bottom-centre dock bubble (Mac-style). The gate stays
  // mounted (rung + selection state preserved); only the card collapses, so the
  // user can flick between the selector and the clip behind it. Hide minimizes
  // to the bubble; the true dismiss (onClose) lives on the restored card's
  // Close button (the bubble itself only restores, no corner ✕ to mis-tap).
  const [minimized, setMinimized] = useState(false);
  // List variant: which row's examples panel is open (single-open accordion).
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  // Mirror into a ref so the keydown handler can read the latest value without
  // re-subscribing the focus-grab effect on every expand/collapse.
  const expandedKeyRef = useRef<string | null>(null);
  expandedKeyRef.current = expandedKey;
  const reduceMotion = useReducedMotion();
  // Tile lock-in (Spot It rungs): on commit, the tapped tile does a quick
  // press-and-settle + teal confirm before the gate advances, so a pick reads as
  // registered rather than the grid vanishing under the finger. reduceMotion
  // commits instantly (no delay, no scale) so motion-averse users lose nothing.
  // The lock MUST release when onSelect fires: on Rung 3 the gate stays mounted
  // (onSelect opens the species popup on top), so a never-cleared `committing`
  // silently swallowed every tap after the popup was dismissed, the grid
  // looked alive but was dead until the whole gate was closed and reopened.
  const [committing, setCommitting] = useState<string | null>(null);
  const commitTimer = useRef<number | null>(null);
  const commitSelect = (key: string) => {
    if (committing) return; // lock out double-taps mid-confirm
    if (reduceMotion) {
      onSelect(key);
      return;
    }
    setCommitting(key);
    commitTimer.current = window.setTimeout(() => {
      commitTimer.current = null;
      setCommitting(null);
      onSelect(key);
    }, 170);
  };
  useEffect(() => {
    return () => {
      if (commitTimer.current !== null) window.clearTimeout(commitTimer.current);
    };
  }, []);
  const dialogRef = useRef<HTMLDivElement>(null);
  const constraintsRef = useRef<HTMLDivElement>(null);

  // Left-docked resizable panel on desktop; bottom-anchored resizable sheet on
  // a phone (see useDocked / the sizing constants above).
  const docked = useDocked();
  const [widthPct, setWidthPct] = useState(DEFAULT_WIDTH_PCT);
  const [heightPct, setHeightPct] = useState(DEFAULT_HEIGHT_PCT);
  const [resizing, setResizing] = useState(false);
  const widthRef = useRef(widthPct);
  widthRef.current = widthPct;
  const heightRef = useRef(heightPct);
  heightRef.current = heightPct;

  // Announce that a gate is up. The sheet now covers the bottom half of a
  // phone, which is exactly where the feed's "swipe up for next" nudge floats,
  // so FeedPlayer listens for this and stands down while a gate is open.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("fs-gate", { detail: { open: true } }));
    return () => {
      window.dispatchEvent(new CustomEvent("fs-gate", { detail: { open: false } }));
    };
  }, []);

  // Restore the viewer's last size once, on mount.
  useEffect(() => {
    setWidthPct(clampWidthPct(readStoredPct(WIDTH_STORAGE_KEY, DEFAULT_WIDTH_PCT)));
    setHeightPct(clampHeightPct(readStoredPct(HEIGHT_STORAGE_KEY, DEFAULT_HEIGHT_PCT)));
  }, []);

  // Below this the sheet is too short for the full-size tile grid, so the grid
  // reflows denser (an extra column, shorter tiles) instead of clipping row one.
  const compact = !docked && heightPct < COMPACT_HEIGHT_PCT;

  /** One pointer-drag resize for both axes: docked drags the right edge (width),
   *  a sheet drags the top grip (height). Live while the finger is down, banked
   *  to localStorage on release. */
  const startResize = (e: React.PointerEvent) => {
    const card = dialogRef.current;
    const track = constraintsRef.current;
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
  };

  /** Keyboard resize. A pointer drag must never be the only way to work a
   *  control (WCAG 2.1.1). Arrows step 2%, Home/End snap to the bounds. */
  const onResizeKey = (e: React.KeyboardEvent) => {
    const [less, more] = docked
      ? ["ArrowLeft", "ArrowRight"]
      : ["ArrowDown", "ArrowUp"];
    const current = docked ? widthRef.current : heightRef.current;
    const min = docked ? MIN_WIDTH_PCT : MIN_HEIGHT_PCT;
    const max = docked ? MAX_WIDTH_PCT : MAX_HEIGHT_PCT;
    let next: number | null = null;
    if (e.key === less) next = current - 2;
    else if (e.key === more) next = current + 2;
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
  };

  // React 18.3 needs `inert` spread as a string for Framer compatibility.
  const inertProps = suspendKeyboard
    ? ({ inert: "" } as Record<string, string>)
    : {};

  // Compact (a short sheet the user has dragged down): one more column of
  // shorter tiles, so the grid reflows into the space that is left instead of
  // showing a clipped first row. Capped at 4 across to stay tappable.
  const gridColumns = compact ? Math.min(columns + 1, 4) : columns;

  // Rule-out plumbing. `announce` drives a polite live region: removing a tile
  // is silent to a screen reader otherwise, so the user would just lose things.
  // `refocusIndex` restores focus after a tile unmounts, which would otherwise
  // dump focus on <body> and break a run of quick eliminations.
  const [ruledOutOpen, setRuledOutOpen] = useState(false);
  const [announce, setAnnounce] = useState("");
  const tileRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const refocusIndex = useRef<number | null>(null);

  useEffect(() => {
    const i = refocusIndex.current;
    if (i === null) return;
    refocusIndex.current = null;
    if (tiles.length === 0) return;
    const target = tiles[Math.min(i, tiles.length - 1)];
    tileRefs.current.get(target.key)?.focus();
  }, [tiles]);

  const ruleOutCount = ruledOut?.items.length ?? 0;
  // Collapse the disclosure once the last elimination has been restored, so it
  // does not reopen empty next time.
  useEffect(() => {
    if (ruleOutCount === 0) setRuledOutOpen(false);
  }, [ruleOutCount]);

  const grid = (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}
    >
      {tiles.map((tile, index) => {
        const isEmpty = !!tile.disabled;
        // Photo tiles get a thin frame so the image fills the tile; silhouette
        // tiles keep a little breathing room for the centred icon + label.
        const hasMedia = !!tile.media;
        return (
          <div key={tile.key} className="relative flex flex-col gap-1">
            <motion.button
              ref={(el: HTMLButtonElement | null) => {
                tileRefs.current.set(tile.key, el);
              }}
              type="button"
              disabled={isEmpty}
              onClick={() => commitSelect(tile.key)}
              onMouseEnter={() => setHovered(tile.key)}
              onMouseLeave={() => setHovered(null)}
              aria-label={tile.ariaLabel ?? tile.label}
              animate={
                committing === tile.key && !reduceMotion
                  ? { scale: [1, 0.95, 1] }
                  : { scale: 1 }
              }
              transition={
                committing === tile.key && !reduceMotion
                  ? { duration: 0.16, ease: EASE.enter, times: [0, 0.45, 1] }
                  : { duration: 0 }
              }
              className={[
                "relative flex flex-col items-center justify-center rounded-modal border transition-colors",
                hasMedia
                  ? "gap-1 p-1"
                  : compact
                    ? "min-h-[84px] gap-1 p-1.5"
                    : "min-h-[128px] gap-2 p-2.5",
                isEmpty
                  ? "cursor-not-allowed border-white/10 opacity-35"
                  : committing === tile.key || hovered === tile.key
                    ? "border-teal-400 bg-teal-500/20 text-teal-300"
                    : "border-white/15 bg-white/5 text-teal-500 hover:border-teal-400 hover:bg-teal-500/20 hover:text-teal-300",
              ].join(" ")}
            >
              {tile.media ? (
                <span className="block aspect-square w-full overflow-hidden rounded-modal bg-white/5">
                  {tile.media}
                </span>
              ) : (
                <span
                  className={[
                    "flex items-center justify-center",
                    compact ? "h-9 w-9" : "h-16 w-16",
                  ].join(" ")}
                >
                  {tile.icon}
                </span>
              )}
              <span
                className={[
                  "text-center font-semibold uppercase leading-tight tracking-wider text-white/70",
                  compact ? "text-[9px]" : "text-[11px]",
                ].join(" ")}
              >
                {tile.label}
              </span>
              {!!tile.badge && tile.badge > 0 && (
                <span className="absolute right-1.5 top-1.5 rounded-full bg-teal-600/80 px-1 text-[10px] font-bold text-white">
                  {tile.badge}
                </span>
              )}
            </motion.button>
            {onRuleOut && !isEmpty && (
              // A SIBLING of the tile button, never a child: the tile is itself
              // a <button>, and nesting one inside it is invalid markup and
              // would swallow this click. 44px hit area (the mobile minimum)
              // around a smaller disc, so it stays tappable without covering
              // much of the photo.
              <button
                type="button"
                onClick={() => {
                  refocusIndex.current = index;
                  setAnnounce(
                    tile.label +
                      " ruled out. " +
                      (ruleOutCount + 1) +
                      " ruled out.",
                  );
                  onRuleOut(tile.key);
                }}
                aria-label={"Rule out " + tile.label}
                title={"Rule out " + tile.label}
                className="absolute right-0 top-0 z-10 flex h-11 w-11 items-center justify-center text-white/75 transition-colors hover:text-teal-200 focus-visible:text-teal-200"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy-900/70 ring-1 ring-white/25">
                  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-4 w-4">
                    <path
                      d="M2.2 8S4.4 4.4 8 4.4 13.8 8 13.8 8s-2.2 3.6-5.8 3.6S2.2 8 2.2 8Z"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinejoin="round"
                    />
                    <circle cx="8" cy="8" r="1.7" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M3.2 12.8 12.8 3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </span>
              </button>
            )}
            {tile.extra}
          </div>
        );
      })}
    </div>
  );

  // List variant (Rung 2): full-width rows, 2x silhouette, per-row chevron that
  // drops an inline examples panel. Row body selects the form; the chevron is a
  // separate control so browsing examples never commits a guess.
  const list = (
    <div className="flex flex-col gap-2">
      {tiles.map((tile) => {
        const isEmpty = !!tile.disabled;
        const isExpanded = expandedKey === tile.key;
        const canExpand = !!tile.renderExpanded;
        return (
          <div
            key={tile.key}
            className={[
              "overflow-hidden rounded-modal border transition-colors",
              committing === tile.key
                ? "border-teal-400 bg-teal-500/15"
                : isExpanded
                  ? "border-teal-400/60 bg-teal-500/10"
                  : "border-white/15 bg-white/5",
            ].join(" ")}
          >
            <div className="flex items-stretch">
              <motion.button
                type="button"
                disabled={isEmpty}
                onClick={() => commitSelect(tile.key)}
                onMouseEnter={() => setHovered(tile.key)}
                onMouseLeave={() => setHovered(null)}
                aria-label={tile.ariaLabel ?? tile.label}
                animate={
                  committing === tile.key && !reduceMotion
                    ? { scale: [1, 0.97, 1] }
                    : { scale: 1 }
                }
                transition={
                  committing === tile.key && !reduceMotion
                    ? { duration: 0.16, ease: EASE.enter, times: [0, 0.45, 1] }
                    : { duration: 0 }
                }
                className={[
                  "flex flex-1 items-center gap-3 p-2.5 text-left transition-colors",
                  isEmpty
                    ? "cursor-not-allowed opacity-35"
                    : committing === tile.key || hovered === tile.key
                      ? "text-teal-300"
                      : "text-teal-500 hover:text-teal-300",
                ].join(" ")}
              >
                <span className="flex h-20 w-20 shrink-0 items-center justify-center">
                  {tile.icon}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[13px] font-semibold uppercase leading-tight tracking-wider text-white/85">
                    {tile.label}
                  </span>
                  {!!tile.badge && tile.badge > 0 && (
                    <span className="text-[11px] font-medium text-white/70">
                      {tile.badge} species
                    </span>
                  )}
                </span>
              </motion.button>
              {canExpand && (
                <button
                  type="button"
                  onClick={() => setExpandedKey(isExpanded ? null : tile.key)}
                  aria-expanded={isExpanded}
                  aria-label={
                    isExpanded
                      ? `Hide examples of ${tile.label}`
                      : `Show examples of ${tile.label}`
                  }
                  className="flex w-12 shrink-0 items-center justify-center self-stretch border-l border-white/10 text-white/50 transition-colors hover:bg-white/10 hover:text-teal-200"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                    className={["transition-transform", isExpanded ? "rotate-180" : ""].join(" ")}
                  >
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </div>
            {canExpand && isExpanded && (
              <div className="max-h-[40vh] overflow-y-auto border-t border-white/10 px-3 py-3 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15">
                {tile.renderExpanded!()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
    <div
      ref={constraintsRef}
      className={[
        "pointer-events-none absolute inset-0 z-30 flex",
        // Docked: hard left, stretched top to bottom, inset from the edges.
        // Sheet: flush to the bottom (a real bottom sheet), so shrinking it
        // uncovers the clip ABOVE it (where the animal is) rather than a
        // useless strip under the footer.
        docked
          // pt-14 clears the feed's transparent overlay header (z-40, sits above
          // the gate), which the full-height panel otherwise runs its title into.
          ? "items-stretch justify-start p-3 pt-14"
          : "items-end justify-center",
      ].join(" ")}
    >
        <AnimatePresence>
        {!minimized && (
        <motion.div
          ref={dialogRef}
          // Free-dragging is gone: the panel is edge-anchored on both surfaces
          // and its grip/edge now RESIZES it, which is what the user actually
          // wanted from moving it (to see the clip behind).
          initial={
            reduceMotion ? false : docked ? { opacity: 0, x: -16 } : { opacity: 0, y: 12 }
          }
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={
            reduceMotion
              ? { opacity: 0, transition: { duration: 0 } }
              : {
                  // Genie-style collapse down toward the dock bubble.
                  opacity: 0,
                  scale: 0.1,
                  y: 280,
                  transition: { duration: 0.26, ease: "easeIn" },
                }
          }
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: DURATION.standard, ease: EASE.enter }
          }
          className={[
            "pointer-events-auto relative flex max-h-full flex-col rounded-card border border-white/12 bg-navy-900/95 px-4 pb-4 shadow-menu backdrop-blur",
            docked
              ? // Full height, and never wider than half the clip (the guarantee
                // that the video stays watchable beside the panel).
                "h-full pt-4"
              : "w-full max-w-[38rem] rounded-b-none pt-7",
            // Skip the height/width transition while the finger is down, or the
            // sheet eases along behind the drag instead of tracking it.
            resizing ? "select-none" : "",
          ].join(" ")}
          style={{
            paddingBottom: `max(1rem, env(safe-area-inset-bottom))`,
            transformOrigin: docked ? "left center" : "bottom center",
            ...(docked
              ? {
                  width: `${widthPct}%`,
                  minWidth: `${MIN_WIDTH_REM}rem`,
                  maxWidth: `${MAX_WIDTH_PCT}%`,
                }
              : { height: `${heightPct}%` }),
          }}
          role="dialog"
          aria-modal="false"
          aria-label={ariaLabel}
          {...inertProps}
        >
          {/* The grip (sheet mode). Same dots the card has always shown at the
              top, but it now RESIZES rather than moves: drag it down and the
              sheet shrinks live under the finger, uncovering the clip above;
              release and it stays. The hit area is a full-width 28px strip so
              it is grabbable without aiming. */}
          {!docked && (
            <div
              role="separator"
              aria-orientation="horizontal"
              aria-label="Drag to resize this panel and see more of the clip"
              aria-valuemin={MIN_HEIGHT_PCT}
              aria-valuemax={MAX_HEIGHT_PCT}
              aria-valuenow={Math.round(heightPct)}
              tabIndex={0}
              onPointerDown={startResize}
              onKeyDown={onResizeKey}
              className="group absolute inset-x-0 top-0 flex h-7 cursor-ns-resize touch-none items-center justify-center text-white/35 hover:text-white/70 focus:outline-none focus-visible:text-teal-300 active:cursor-grabbing"
            >
              <svg
                width="16"
                height="6"
                viewBox="0 0 16 6"
                fill="currentColor"
                aria-hidden="true"
                className={resizing ? "text-teal-400" : ""}
              >
                <circle cx="3" cy="1.5" r="1" /><circle cx="8" cy="1.5" r="1" /><circle cx="13" cy="1.5" r="1" />
                <circle cx="3" cy="4.5" r="1" /><circle cx="8" cy="4.5" r="1" /><circle cx="13" cy="4.5" r="1" />
              </svg>
            </div>
          )}

          {/* "Full video", the explicit way out to the clip on a phone, sat on
              the sheet's top edge where the video meets it. Drops the sheet to
              the dock bubble (rung state intact) so the clip plays full screen;
              the bubble restores it. Labelled, not an icon: this is the control
              a first-time user needs to find without hunting, and it replaces
              the header's icon-only minimise on this surface. */}
          {!docked && (
            <button
              type="button"
              onClick={() => setMinimized(true)}
              className="absolute right-2 top-0 z-20 inline-flex h-7 items-center gap-1 rounded-full px-2 text-[10px] font-semibold uppercase tracking-wider text-teal-300/90 hover:text-teal-200"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                <path
                  d="M6 2H2v4M10 2h4v4M6 14H2v-4M10 14h4v-4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Full video
            </button>
          )}

          {/* Resize edge (docked only). Same control on the other axis: drag the
              right edge to set how much of the clip the panel covers. */}
          {docked && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize this panel"
              aria-valuemin={MIN_WIDTH_PCT}
              aria-valuemax={MAX_WIDTH_PCT}
              aria-valuenow={Math.round(widthPct)}
              tabIndex={0}
              onPointerDown={startResize}
              onKeyDown={onResizeKey}
              className="group absolute inset-y-0 -right-1.5 z-10 flex w-3 cursor-col-resize touch-none items-center justify-center focus:outline-none"
            >
              <span
                aria-hidden="true"
                className={[
                  "h-16 w-1 rounded-full transition-colors",
                  resizing
                    ? "bg-teal-400"
                    : "bg-white/25 group-hover:bg-teal-400/80 group-focus-visible:bg-teal-400",
                ].join(" ")}
              />
            </div>
          )}

          {/* Header row: back (arrow only), the title, then minimise + close.
              A flex row so the controls never overlap the title (they used to
              be absolute-positioned over a centred title). */}
          <div className="mb-2 flex shrink-0 items-center gap-2">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                aria-label="Back to the previous step"
                title="Back a step"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
              >
                <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M11 7H3M7 11L3 7l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : (
              <span className="h-10 w-10 shrink-0" aria-hidden="true" />
            )}

            <p className="min-w-0 flex-1 text-balance text-center text-[13px] font-semibold leading-tight text-white/85">
              {title}
            </p>

            <div className="flex shrink-0 items-center gap-1">
              {docked && (
              <button
                type="button"
                onClick={() => setMinimized(true)}
                aria-label="Minimise to a bubble and watch the clip"
                title="Minimise"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
              >
                {/* Window-style minimise bar (sits next to the × close, so the
                    two read as standard minimise / close controls). */}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M4 11h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close the selector"
                title="Close"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
              >
                <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">

            {/* Breadcrumb of prior picks, each can jump back to its rung. */}
            {breadcrumb && breadcrumb.length > 0 && (
              <nav
                aria-label="Your picks so far"
                className="mb-2.5 flex shrink-0 flex-wrap items-center justify-center gap-x-1 gap-y-1"
              >
                {breadcrumb.map((c, i) => (
                  <span key={`${c.label}-${i}`} className="flex items-center gap-1">
                    {i > 0 && <span aria-hidden="true" className="text-white/25">›</span>}
                    {c.onClick ? (
                      <button
                        type="button"
                        onClick={c.onClick}
                        className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-300/90 hover:bg-white/15 hover:text-teal-200"
                      >
                        {c.label}
                      </button>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">
                        {c.label}
                      </span>
                    )}
                  </span>
                ))}
              </nav>
            )}

            {/* Single scroll owner: the card is capped to the viewport and the
                header / breadcrumb / footer are pinned, so the TILES scroll when
                a rung has more rows than fit (e.g. the 7-row fish body-shape list,
                or any gate in landscape). Without this the centred card overflowed
                the overflow-hidden feed item and clipped its own drag handle and
                Skip footer with no way to reach them. */}
            <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15">
              {tiles.length === 0 && emptyMessage ? (
                <p className="px-2 py-6 text-center text-sm text-white/60">{emptyMessage}</p>
              ) : variant === "list" ? (
                list
              ) : (
                grid
              )}
            </div>


            {/* Ruled-out summary. Pinned under the grid rather than inside the
                scroll area, so it is reachable without scrolling past 24 tiles
                AND still present when everything has been ruled out (which
                replaces the grid with `emptyMessage`). */}
            {ruledOut && ruleOutCount > 0 && (
              <div className="mt-2 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRuledOutOpen((v) => !v)}
                    aria-expanded={ruledOutOpen}
                    className="inline-flex min-h-[44px] flex-1 items-center gap-1.5 rounded-full px-2 text-left text-[11px] font-semibold uppercase tracking-wider text-white/60 hover:text-teal-200"
                  >
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                      className={[
                        "h-3 w-3 shrink-0 transition-transform",
                        ruledOutOpen ? "rotate-180" : "",
                      ].join(" ")}
                    >
                      <path d="M4 6.5 8 10.5 12 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {ruleOutCount} ruled out
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAnnounce("All " + ruleOutCount + " brought back.");
                      ruledOut.onRestoreAll();
                    }}
                    className="inline-flex min-h-[44px] items-center px-2 text-[11px] font-semibold uppercase tracking-wider text-white/60 hover:text-teal-200"
                  >
                    Bring all back
                  </button>
                </div>
                {ruledOutOpen && (
                  <div className="mt-1 max-h-28 overflow-y-auto pb-1 [scrollbar-width:thin]">
                    <ul className="flex flex-wrap gap-1.5">
                      {ruledOut.items.map((item) => (
                        <li key={item.key}>
                          <button
                            type="button"
                            onClick={() => {
                              setAnnounce(item.label + " brought back.");
                              ruledOut.onRestore(item.key);
                            }}
                            aria-label={"Bring back " + item.label}
                            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/60 hover:border-teal-400 hover:bg-teal-500/15 hover:text-teal-100"
                          >
                            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-3.5 w-3.5 shrink-0">
                              <path d="M3.5 8a4.5 4.5 0 1 1 1.6 3.45" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                              <path d="M3.2 4.8v3.1h3.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            {item.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Rule-out changes are silent to assistive tech otherwise: the
                tile just vanishes. */}
            <p aria-live="polite" className="sr-only">
              {announce}
            </p>

            {/* The prominent "compare them all" escape hatch (Rungs 1 + 2). Same
                outline treatment as `compare`, but it opens the full candidate
                grid for this bucket rather than a curated look-alike set, so it
                is always available where `compare` is not. */}
            {notSure?.prominent && (
              <button
                type="button"
                onClick={notSure.onClick}
                className="mt-3 inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 text-center text-[11px] font-semibold uppercase tracking-wider text-white/80 hover:border-teal-400 hover:bg-teal-500/15 hover:text-teal-100"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden="true">
                  <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                  <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                  <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                  <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
                </svg>
                {notSure.label}
              </button>
            )}

            {compare && (
              <button
                type="button"
                onClick={compare.onClick}
                className="mt-3 inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/80 hover:border-teal-400 hover:bg-teal-500/15 hover:text-teal-100"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                  <rect x="2" y="3" width="5" height="10" rx="1" stroke="currentColor" strokeWidth="1.4" />
                  <rect x="9" y="3" width="5" height="10" rx="1" stroke="currentColor" strokeWidth="1.4" />
                </svg>
                {compare.label}
              </button>
            )}

            {coarse && (
              <button
                type="button"
                onClick={coarse.onClick}
                className="mt-3 inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-teal-500/40 bg-teal-500/10 px-3 text-[11px] font-semibold uppercase tracking-wider text-teal-100 hover:border-teal-400 hover:bg-teal-500/20"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                  <path d="M8 11V7M8 5h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
                </svg>
                {coarse.label}
              </button>
            )}

            {((notSure && !notSure.prominent) || skip) && (
              <div className="mt-3 flex shrink-0 items-center justify-between">
                {notSure && !notSure.prominent ? (
                  <button
                    type="button"
                    onClick={notSure.onClick}
                    className="inline-flex min-h-[44px] items-center px-2 -mx-2 text-[10px] uppercase tracking-wider text-white/70 hover:text-white/80"
                  >
                    {notSure.label}
                  </button>
                ) : (
                  <span />
                )}
                {skip && (
                  <button
                    type="button"
                    onClick={skip.onClick}
                    className="inline-flex min-h-[44px] items-center gap-1 px-2 -mx-2 text-[10px] uppercase tracking-wider text-teal-400/80 hover:text-teal-300"
                  >
                    {skip.label}
                    <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" aria-hidden="true">
                      <path d="M2.5 7h9M8 3.5L11.5 7 8 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
        </motion.div>
        )}
        </AnimatePresence>
    </div>

      {/* Dock bubble, the minimized state. Tap to restore the card in place
          (dismiss lives on the restored card's Close button, not here). */}
      <AnimatePresence>
        {minimized && (
          <div
            className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-end"
            style={{
              paddingBottom: `max(1rem, env(safe-area-inset-bottom))`,
              paddingRight: `max(1rem, env(safe-area-inset-right))`,
            }}
          >
            <motion.div
              className="pointer-events-auto relative"
              // Tucks into the bottom-right corner (scales up while sliding in
              // from down-and-right), clear of the bottom-left depth/location HUD.
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.3, x: 28, y: 28 }}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.3, x: 28, y: 28 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: EASE.enter }}
            >
              <button
                type="button"
                onClick={() => setMinimized(false)}
                aria-label={bubbleLabel}
                title={bubbleLabel}
                className="inline-flex h-12 items-center gap-2 rounded-full border border-teal-300/40 bg-navy-900/95 pl-3 pr-4 text-sm font-semibold text-teal-300 shadow-menu backdrop-blur transition-colors hover:border-teal-300 hover:bg-teal-500/25 hover:text-teal-200"
              >
                {/* Target reticle reads "identify / resume" (T-25), a magnifier
                    glyph conventionally means "search", not "resume the ID". The
                    visible "Resume" label removes the unlabelled-affordance risk. */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2" />
                  <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Resume
              </button>
              {/* The dismiss ✕ used to live here as a corner badge, but it was
                  too small and too close to the screen edge to hit reliably on a
                  phone. Closing now happens on the restored card (tap the bubble
                  to bring it back, then use Close). The bubble only restores. */}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
