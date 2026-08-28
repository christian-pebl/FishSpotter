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
 * PHOTO TILES (28 Aug 2026) split that one button in two, because a species
 * tile has two different jobs. When a tile carries `photos`, its picture becomes
 * a comparison viewer (tap the left or right half to flick through that
 * species' other reference shots, against the clip still playing beside it) and
 * the NAME ROW underneath becomes the select control. Picture to look, name to
 * choose. A tile with one photo has nothing to flick through, so its picture
 * selects too, exactly as before, rather than swallowing the tap. Every other
 * rung keeps the single-button tile untouched.
 *
 * `variant="list"` (Rung 2) lays tiles out as full-width rows with a 2x
 * silhouette and a per-row chevron that drops an inline `renderExpanded` panel
 * (the body-form examples) directly below that row. Single-open accordion: only
 * one row's panel is mounted at a time, so we never fire N photo fetches at
 * once. `variant="grid"` (default, Rung 1 + Rung 3) is unchanged.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { DURATION, EASE } from "@/lib/motion";
import {
  COMPACT_HEIGHT_PCT,
  MAX_HEIGHT_PCT,
  MAX_WIDTH_PCT,
  MIN_HEIGHT_PCT,
  MIN_WIDTH_PCT,
  MIN_WIDTH_REM,
  useDocked,
  useSplitPanel,
  useSplitResize,
  useStoredSplitSize,
} from "@/lib/split-screen";

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

/** A lazy tile photo that starts transparent and fades in over ~180ms
 * (DURATION.micro) once it actually paints, so tiles pop in as their photos
 * arrive instead of snapping. A cached image can finish loading before React
 * attaches onLoad (notably on a remount), which would strand it at opacity 0,
 * so the ref callback checks img.complete on mount and reveals it synchronously.
 * Moved here from CandidateGate when the tile picture became a viewer. */
function TilePhoto({ src }: { src: string }) {
  const reduce = useReducedMotion();
  const [loaded, setLoaded] = useState(false);
  const onRef = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete) setLoaded(true);
  }, []);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={onRef}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
      className={[
        "h-full w-full object-cover",
        // duration-[180ms] mirrors DURATION.micro (0.18s); CSS can't import the
        // JS token, so it's inlined here with this note.
        reduce ? "opacity-100" : "opacity-0 transition-opacity duration-[180ms] ease-out",
        loaded ? "opacity-100" : "",
      ].join(" ")}
    />
  );
}

/** The chevron shown at the middle of each tap half. Deliberately small and
 * low-contrast: it is a hint that the halves are live, not a button competing
 * with the photo. It sits on its own dark disc so it reads over a pale sandy
 * seabed and a black midwater shot alike, and it brightens on hover. */
function NavChevron({ dir }: { dir: "prev" | "next" }) {
  return (
    <span
      aria-hidden="true"
      className={[
        "pointer-events-none absolute top-1/2 z-10 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full",
        "bg-navy-900/45 text-white/70 transition-all duration-150",
        "group-hover/nav:bg-navy-900/80 group-hover/nav:text-white group-active/nav:scale-90",
        "group-focus-visible/nav:bg-navy-900/80 group-focus-visible/nav:text-white",
        dir === "prev" ? "left-1" : "right-1",
      ].join(" ")}
    >
      <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3">
        <path
          d={dir === "prev" ? "M10 3.5 5.5 8l4.5 4.5" : "M6 3.5 10.5 8 6 12.5"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/**
 * The tile picture as a small comparison viewer: one photo at a time, with the
 * left half stepping back and the right half stepping forward through the rest
 * of that species' cached reference shots.
 *
 * Two decisions worth keeping:
 *  - it WRAPS at both ends. On a viewer this small a dead end reads as a broken
 *    tap; wrapping plus the dot row (which says exactly where you are) never
 *    does.
 *  - only the visible frame is mounted, so a grid of 24 tiles still loads 24
 *    images, not 150. The rest are fetched the moment the user asks for them.
 *
 * The halves are `aria-hidden` and out of the tab order on purpose: three extra
 * tab stops per tile across a 24-tile grid is a worse keyboard experience than
 * the Left/Right arrow route the name button provides, which is the ordinary
 * carousel pattern.
 */
function TilePhotoFrames({
  srcs,
  index,
  label,
  onStep,
}: {
  srcs: string[];
  index: number;
  label: string;
  onStep: (delta: number) => void;
}) {
  const src = srcs[index] ?? srcs[0];
  return (
    <>
      <TilePhoto key={src} src={src} />
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => onStep(-1)}
        className="group/nav absolute inset-y-0 left-0 z-10 w-1/2 cursor-pointer"
      >
        <NavChevron dir="prev" />
      </button>
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => onStep(1)}
        className="group/nav absolute inset-y-0 right-0 z-10 w-1/2 cursor-pointer"
      >
        <NavChevron dir="next" />
      </button>
      {/* Position readout. Scrim first so the dots survive a bright photo. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex h-6 items-end justify-center gap-1 bg-gradient-to-t from-navy-900/70 to-transparent pb-1"
      >
        {srcs.map((s, i) => (
          <span
            key={s}
            className={[
              "h-1 w-1 rounded-full transition-colors",
              i === index ? "bg-white" : "bg-white/40",
            ].join(" ")}
          />
        ))}
      </span>
      <span className="sr-only">{`${label}, photo ${index + 1} of ${srcs.length}`}</span>
    </>
  );
}

/**
 * The rule-out control, drawn as a cut-off top-right corner of the picture.
 *
 * It replaced a solid disc floating over the photo (28 Aug 2026). The disc had
 * to be opaque to survive dark footage, which made an "I do not want this one"
 * control the loudest thing on a grid whose whole job is looking at fish. A
 * folded corner is quiet at rest and still unmistakably a control.
 *
 * The clip path is on the BUTTON, not just the fill, so the hit area is exactly
 * the triangle you can see. A 44px square hit box behind a 44px triangle would
 * put half its area over plain photo, i.e. an invisible trap sitting inside the
 * "next photo" half. Legs of 44 (36 when the sheet is compact) give a target of
 * ~970px2 in the easiest corner of the tile to hit with a thumb, and the action
 * is reversible from the "ruled out" row under the grid.
 *
 * Contrast is the other lesson already paid for: too subtle got fixed once
 * before (commit 7e42060, "strengthen the rule-out disc so it holds over dark
 * photos"). So the wedge carries three separable cues, and a photo would have
 * to defeat all three at once to hide it: a dark fill for pale seabeds, a white
 * hairline along the fold, and a white glyph.
 */
function RuleOutCorner({
  label,
  compact,
  onClick,
}: {
  label: string;
  compact: boolean;
  onClick: () => void;
}) {
  const size = compact ? 36 : 44;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={"Rule out " + label}
      title={"Rule out " + label}
      className="group/cut absolute right-0 top-0 z-20 focus:outline-none"
      style={{
        height: size,
        width: size,
        clipPath: "polygon(0 0, 100% 0, 100% 100%)",
      }}
    >
      <svg
        viewBox="0 0 44 44"
        fill="none"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      >
        <path
          d="M0 0H44V44Z"
          className="fill-navy-900/55 transition-colors group-hover/cut:fill-navy-900/85 group-focus-visible/cut:fill-navy-900/85"
        />
        <path
          d="M0 0 44 44"
          className="stroke-white/30 transition-colors group-hover/cut:stroke-teal-300"
          strokeWidth="1.5"
        />
        {/* Eye with a slash: the same "rule out" glyph the species popup and
            the ruled-out chips use, so the action reads as one thing. */}
        <g
          transform="translate(24 5) scale(0.9)"
          className="stroke-white/85 transition-colors group-hover/cut:stroke-teal-200 group-focus-visible/cut:stroke-teal-200"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1.4 7S3.6 3.6 7 3.6 12.6 7 12.6 7s-2.2 3.4-5.6 3.4S1.4 7 1.4 7Z" />
          <circle cx="7" cy="7" r="1.5" />
          <path d="M2.4 11.4 11.6 2.6" />
        </g>
      </svg>
    </button>
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
  /** Rung-3 only. Every cached reference photo for this species, best first.
   * When present the tile's picture becomes a small comparison viewer: tap its
   * left or right half to flick between shots without leaving the grid (see
   * TilePhotoFrames). `media` is then the loading / no-photo fallback only. */
  photos?: string[];
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
 * Desktop docking (28 Aug 2026). On a wide screen the gate does not float
 * centred over the clip. It docks to the LEFT edge, full height, capped at half
 * the width, so the video keeps playing (and stays watchable) beside it rather
 * than underneath it. On a phone the same panel is a bottom sheet and the clip
 * sits above it. Drag the seam edge (or the sheet's grip) to re-balance; the
 * size persists across clips and sessions.
 *
 * The geometry itself now lives in `@/lib/split-screen`, because the tiles are
 * no longer the only thing that occupies the working half: the comparison, the
 * species card, the reveal and the map all render into the same rect and
 * inherit the same stored size. See that module for the contract.
 */

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
  const { widthPct, setWidthPct, heightPct, setHeightPct } = useStoredSplitSize();
  const { resizing, startResize, onResizeKey } = useSplitResize({
    docked,
    widthPct,
    heightPct,
    setWidthPct,
    setHeightPct,
    panelRef: dialogRef,
    trackRef: constraintsRef,
  });

  // Announce the space this gate is taking, live. Two listeners depend on it:
  // FeedPlayer stands its "swipe up for next" nudge down while a gate is up,
  // and FeedCard shrinks the VIDEO into the space that is left, so the clip is
  // resized beside (or above) the panel rather than hidden behind it. Re-fires
  // on every resize, mid-drag included, so the split tracks the finger.
  //
  // Minimized counts as closed: the card is a dock bubble then, and the clip
  // should go back to full bleed.
  useSplitPanel(
    dialogRef,
    minimized
      ? { open: false }
      : { open: true, docked, widthPct, heightPct },
  );

  // Below this the sheet is too short for the full-size tile grid, so the grid
  // reflows denser (an extra column, shorter tiles) instead of clipping row one.
  const compact = !docked && heightPct < COMPACT_HEIGHT_PCT;

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

  // Which reference photo each photo-tile is showing. Kept in a ref as well as
  // state so a fast run of taps on "next" cannot read a stale index and drop a
  // step: React batches the renders, the ref does not.
  const [frameByTile, setFrameByTile] = useState<Record<string, number>>({});
  const frameRef = useRef<Record<string, number>>({});
  const stepFrame = (key: string, count: number, delta: number, label: string) => {
    if (count < 2) return;
    const next = ((((frameRef.current[key] ?? 0) + delta) % count) + count) % count;
    frameRef.current = { ...frameRef.current, [key]: next };
    setFrameByTile(frameRef.current);
    // Reuse the rule-out live region: flicking a photo is silent to a screen
    // reader otherwise, so a keyboard user would move through the set blind.
    setAnnounce(`${label}, photo ${next + 1} of ${count}`);
  };

  const grid = (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}
    >
      {tiles.map((tile, index) => {
        const isEmpty = !!tile.disabled;
        const frames = tile.photos ?? [];
        // Photo tiles get a thin frame so the image fills the tile; silhouette
        // tiles keep a little breathing room for the centred icon + label.
        const hasMedia = !!tile.media || frames.length > 0;
        // Split the tile only when there is genuinely something to flick to.
        // One photo keeps the picture as a select target rather than turning it
        // into a tap that does nothing.
        const canFlip = frames.length > 1 && !isEmpty;
        const frame = Math.min(frameByTile[tile.key] ?? 0, Math.max(frames.length - 1, 0));
        const active = committing === tile.key || hovered === tile.key;

        const chrome = [
          "relative flex flex-col items-center justify-center rounded-modal border transition-colors",
          hasMedia
            ? "gap-1 p-1"
            : compact
              ? "min-h-[84px] gap-1 p-1.5"
              : "min-h-[128px] gap-2 p-2.5",
          isEmpty
            ? "cursor-not-allowed border-white/10 opacity-35"
            : active
              ? "border-teal-400 bg-teal-500/20 text-teal-300"
              : "border-white/15 bg-white/5 text-teal-500 hover:border-teal-400 hover:bg-teal-500/20 hover:text-teal-300",
        ].join(" ");

        const labelClass = [
          "text-center font-semibold uppercase leading-tight tracking-wider text-white/70",
          compact ? "text-[9px]" : "text-[11px]",
        ].join(" ");

        const commitAnimate =
          committing === tile.key && !reduceMotion ? { scale: [1, 0.95, 1] } : { scale: 1 };
        const commitTransition =
          committing === tile.key && !reduceMotion
            ? { duration: 0.16, ease: EASE.enter, times: [0, 0.45, 1] }
            : { duration: 0 };

        const badge = !!tile.badge && tile.badge > 0 && (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-teal-600/80 px-1 text-[10px] font-bold text-white">
            {tile.badge}
          </span>
        );

        const ruleOut = onRuleOut && !isEmpty && (
          <RuleOutCorner
            label={tile.label}
            compact={compact}
            onClick={() => {
              refocusIndex.current = index;
              setAnnounce(
                tile.label + " ruled out. " + (ruleOutCount + 1) + " ruled out.",
              );
              onRuleOut(tile.key);
            }}
          />
        );

        // MEDIA TILE (Rung 3). Picture on top, name row underneath, both inside
        // one card. The picture never nests a button inside a button: the
        // select overlay, the two flick halves and the rule-out corner are all
        // siblings inside the picture's own rounded, overflow-hidden box, which
        // is also what clips the corner wedge to the photo's rounded edge.
        if (hasMedia) {
          return (
            <motion.div
              key={tile.key}
              animate={commitAnimate}
              transition={commitTransition}
              onMouseEnter={() => setHovered(tile.key)}
              onMouseLeave={() => setHovered(null)}
              className={chrome + " focus-within:border-teal-400"}
            >
              {/* 4:3, not square (28 Aug 2026). Two reasons, and they point the same
                  way: almost every reference photo is landscape and almost every
                  animal in this catalogue is wider than it is tall, so a square
                  centre-crop of a fish throws away its head and tail, which are
                  exactly what the user is being asked to compare. The shorter
                  frame also buys back more height than the new name row costs,
                  so the phone's default half-and-half sheet still shows a whole
                  tile, name included, without scrolling. */}
              <div className="relative block aspect-[4/3] w-full overflow-hidden rounded-modal bg-white/5">
                {frames.length > 0 ? (
                  canFlip ? (
                    <TilePhotoFrames
                      srcs={frames}
                      index={frame}
                      label={tile.label}
                      onStep={(d) => stepFrame(tile.key, frames.length, d, tile.label)}
                    />
                  ) : (
                    // Not `frames[0]`: `canFlip` also goes false while a guess
                    // is submitting, and snapping back to photo 1 at that exact
                    // moment would flash a different animal under the finger.
                    <TilePhoto key={frames[frame] ?? frames[0]} src={frames[frame] ?? frames[0]} />
                  )
                ) : (
                  tile.media
                )}
                {/* One photo (or a silhouette fallback): the picture keeps its
                    old job and selects, so no tap is ever wasted. Hidden from
                    the tab order because the name row below carries the same
                    action with the accessible label. */}
                {!canFlip && !isEmpty && (
                  <button
                    type="button"
                    aria-hidden="true"
                    tabIndex={-1}
                    onClick={() => commitSelect(tile.key)}
                    className="absolute inset-0 z-10 cursor-pointer"
                  />
                )}
                {ruleOut}
              </div>
              <button
                ref={(el: HTMLButtonElement | null) => {
                  tileRefs.current.set(tile.key, el);
                }}
                type="button"
                disabled={isEmpty}
                onClick={() => commitSelect(tile.key)}
                onKeyDown={(e) => {
                  if (!canFlip) return;
                  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                  e.preventDefault();
                  stepFrame(tile.key, frames.length, e.key === "ArrowLeft" ? -1 : 1, tile.label);
                }}
                aria-label={tile.ariaLabel ?? tile.label}
                aria-keyshortcuts={canFlip ? "ArrowLeft ArrowRight" : undefined}
                className={[
                  "flex min-h-[44px] w-full items-center justify-center rounded-modal px-1 py-1 transition-colors",
                  labelClass,
                  isEmpty
                    ? "cursor-not-allowed"
                    : "hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300",
                ].join(" ")}
              >
                {tile.label}
              </button>
              {badge}
              {tile.extra}
            </motion.div>
          );
        }

        // SILHOUETTE TILE (Rungs 1 & 2). One button, exactly as before.
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
              animate={commitAnimate}
              transition={commitTransition}
              className={chrome}
            >
              <span
                className={[
                  "flex items-center justify-center",
                  compact ? "h-9 w-9" : "h-16 w-16",
                ].join(" ")}
              >
                {tile.icon}
              </span>
              <span className={labelClass}>{tile.label}</span>
              {badge}
            </motion.button>
            {ruleOut}
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
        // Both surfaces sit FLUSH against the frame edges, no gutter and no
        // corner radius, so this reads as an OS-style split screen rather than a
        // floating window clipped by the bottom of the card. The one inset is
        // pt-14 when docked, which keeps the panel clear of the feed's
        // transparent overlay header (the menu button + FishSpotter wordmark,
        // z-40, which paints over this panel).
        docked ? "items-stretch justify-start pt-14" : "items-end justify-center",
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
            "pointer-events-auto relative flex max-h-full flex-col bg-navy-900/95 px-4 pb-4 shadow-menu backdrop-blur",
            docked
              ? // Full height, and never wider than half the clip (the guarantee
                // that the video stays watchable beside the panel). One border,
                // on the side that meets the clip: that edge is the split seam.
                "h-full border-r border-white/12 pt-4"
              : "w-full border-t border-white/12 pt-7",
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
