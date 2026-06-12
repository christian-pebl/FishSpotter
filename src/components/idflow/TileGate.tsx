"use client";

/**
 * TileGate — the reusable "Spot It" gate chrome.
 *
 * Shared by Rung 1 (shape class), Rung 2 (body shape) and Rung 3 (CandidateGate
 * species photo grid). It owns:
 *   - the non-covering floating card (clip keeps playing/visible behind it),
 *   - drag-from-the-grip-handle only (so tiles stay tappable),
 *   - the modal a11y (focus grab, Escape, Tab trap, body-scroll lock, focus
 *     restore),
 *   - a "Hide" affordance back to the video, an optional "Back" affordance to
 *     the previous rung, and an optional breadcrumb of prior picks,
 *   - a tile grid (optionally scrollable) + an optional Not-sure / Skip footer.
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
import { AnimatePresence, motion, useReducedMotion, useDragControls } from "framer-motion";
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
  scrollable = false,
  emptyMessage,
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
  notSure?: { label: string; onClick: () => void };
  skip?: { label: string; onClick: () => void };
  /** A primary "submit the coarse shape class" action ("It's just a Fish"),
   *  rendered as a full-width button above the notSure/skip row. Lets a user
   *  who can't get to species commit the shape class for partial credit. */
  coarse?: { label: string; onClick: () => void };
  /** Wrap the grid in a max-height scroll region (Rung-3 photo grids). */
  scrollable?: boolean;
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
  // Close button (the bubble itself only restores — no corner ✕ to mis-tap).
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
  const [committing, setCommitting] = useState<string | null>(null);
  const commitSelect = (key: string) => {
    if (committing) return; // lock out double-taps mid-confirm
    if (reduceMotion) {
      onSelect(key);
      return;
    }
    setCommitting(key);
    window.setTimeout(() => onSelect(key), 170);
  };
  const dialogRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const constraintsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // While minimized the card is gone and only the bubble (a single button) is
    // up, so we release the focus trap + scroll lock and let the clip behind be
    // fully interactive. Restoring re-runs this effect and re-engages both.
    if (minimized) return;
    const lastFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (!suspendKeyboard) {
      dialog
        ?.querySelector<HTMLElement>(
          "button:not([disabled]), [tabindex]:not([tabindex='-1'])",
        )
        ?.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (suspendKeyboard) return;
      // A true modal (the inline gallery's photo lightbox sets
      // aria-modal="true") is open on top — yield all keys to it. The gate is
      // aria-modal="false", so it never matches itself.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (e.key === "Escape") {
        // Collapse an open examples panel first; only then close the gate.
        if (expandedKeyRef.current !== null) {
          setExpandedKey(null);
          return;
        }
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const focusables = dialog.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [tabindex]:not([tabindex='-1'])",
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      lastFocused?.focus?.();
    };
  }, [onClose, suspendKeyboard, minimized]);

  // React 18.3 needs `inert` spread as a string for Framer compatibility.
  const inertProps = suspendKeyboard
    ? ({ inert: "" } as Record<string, string>)
    : {};

  const grid = (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {tiles.map((tile) => {
        const isEmpty = !!tile.disabled;
        // Photo tiles get a thin frame so the image fills the tile; silhouette
        // tiles keep a little breathing room for the centred icon + label.
        const hasMedia = !!tile.media;
        return (
          <div key={tile.key} className="flex flex-col gap-1">
            <motion.button
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
                hasMedia ? "gap-1 p-1" : "min-h-[128px] gap-2 p-2.5",
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
                <span className="flex h-16 w-16 items-center justify-center">
                  {tile.icon}
                </span>
              )}
              <span className="text-center text-[11px] font-semibold uppercase leading-tight tracking-wider text-white/70">
                {tile.label}
              </span>
              {!!tile.badge && tile.badge > 0 && (
                <span className="absolute right-1.5 top-1.5 rounded-full bg-teal-600/80 px-1 text-[10px] font-bold text-white">
                  {tile.badge}
                </span>
              )}
            </motion.button>
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
    <div ref={constraintsRef} className="pointer-events-none absolute inset-0 z-30">
      <div className="pointer-events-none absolute left-1/2 top-1/2 w-[min(38rem,calc(100%-1.5rem))] -translate-x-1/2 -translate-y-1/2">
        <AnimatePresence>
        {!minimized && (
        <motion.div
          ref={dialogRef}
          drag
          dragControls={dragControls}
          dragListener={false}
          dragMomentum={false}
          dragElastic={0.05}
          dragConstraints={constraintsRef}
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
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
          className="pointer-events-auto relative rounded-card border border-white/12 bg-navy-900/95 px-4 pb-4 pt-7 shadow-menu backdrop-blur"
          style={{
            paddingBottom: `max(1rem, env(safe-area-inset-bottom))`,
            transformOrigin: "bottom center",
          }}
          role="dialog"
          aria-modal="false"
          aria-label={ariaLabel}
          {...inertProps}
        >
          {/* Drag handle — drag only starts here (dragListener=false). */}
          <button
            type="button"
            onPointerDown={(e) => dragControls.start(e)}
            aria-label="Drag to move this box"
            className="absolute left-1/2 top-0 flex h-7 w-12 -translate-x-1/2 cursor-grab touch-none items-center justify-center text-white/35 hover:text-white/70 active:cursor-grabbing"
          >
            <svg width="16" height="6" viewBox="0 0 16 6" fill="currentColor" aria-hidden="true">
              <circle cx="3" cy="1.5" r="1" /><circle cx="8" cy="1.5" r="1" /><circle cx="13" cy="1.5" r="1" />
              <circle cx="3" cy="4.5" r="1" /><circle cx="8" cy="4.5" r="1" /><circle cx="13" cy="4.5" r="1" />
            </svg>
          </button>

          {/* Header row: back (arrow only), the title, then minimise + close.
              A flex row so the controls never overlap the title (they used to
              be absolute-positioned over a centred title). */}
          <div className="mb-2 flex items-center gap-2">
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

            <p className="min-w-0 flex-1 truncate text-center text-[11px] font-semibold uppercase tracking-widest text-white/55">
              {title}
            </p>

            <div className="flex shrink-0 items-center gap-1">
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

          <div>

            {/* Breadcrumb of prior picks — each can jump back to its rung. */}
            {breadcrumb && breadcrumb.length > 0 && (
              <nav
                aria-label="Your picks so far"
                className="mb-2.5 flex flex-wrap items-center justify-center gap-x-1 gap-y-1"
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

            {tiles.length === 0 && emptyMessage ? (
              <p className="px-2 py-6 text-center text-sm text-white/60">{emptyMessage}</p>
            ) : variant === "list" ? (
              list
            ) : scrollable ? (
              <div className="-mx-1 max-h-[38vh] overflow-y-auto px-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15">
                {grid}
              </div>
            ) : (
              grid
            )}

            {coarse && (
              <button
                type="button"
                onClick={coarse.onClick}
                className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full border border-teal-500/40 bg-teal-500/10 px-3 text-[11px] font-semibold uppercase tracking-wider text-teal-100 hover:border-teal-400 hover:bg-teal-500/20"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                  <path d="M8 11V7M8 5h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
                </svg>
                {coarse.label}
              </button>
            )}

            {(notSure || skip) && (
              <div className="mt-3 flex items-center justify-between">
                {notSure ? (
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
    </div>

      {/* Dock bubble — the minimized state. Tap to restore the card in place
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
                className="flex h-14 w-14 items-center justify-center rounded-full border border-teal-300/40 bg-navy-900/95 text-teal-300 shadow-menu backdrop-blur transition-colors hover:border-teal-300 hover:bg-teal-500/25 hover:text-teal-200"
              >
                {/* Magnifier-over-target "Spot It" glyph + an up-cue. */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2" />
                  <path d="M15.5 15.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M10.5 13V8M8 10.5l2.5-2.5L13 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
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
