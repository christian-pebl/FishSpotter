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
 * renders beneath the button (Rung 2 uses it for the "Examples" button).
 */

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useDragControls } from "framer-motion";
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
  /** Optional node under the select button (Rung 2: the "Examples" button). */
  extra?: React.ReactNode;
  ariaLabel?: string;
};

export type Crumb = { label: string; onClick?: () => void };

export function TileGate({
  ariaLabel,
  title,
  tiles,
  columns = 4,
  onSelect,
  onClose,
  onBack,
  breadcrumb,
  notSure,
  skip,
  scrollable = false,
  emptyMessage,
  suspendKeyboard = false,
}: {
  ariaLabel: string;
  title: string;
  tiles: TileSpec[];
  columns?: number;
  onSelect: (key: string) => void;
  onClose: () => void;
  /** Optional "Back" to the previous rung (top-left). Omit on Rung 1. */
  onBack?: () => void;
  /** Prior picks, newest last; each can jump back to its rung. */
  breadcrumb?: Crumb[];
  notSure?: { label: string; onClick: () => void };
  skip?: { label: string; onClick: () => void };
  /** Wrap the grid in a max-height scroll region (Rung-3 photo grids). */
  scrollable?: boolean;
  /** Shown instead of the grid when there are no tiles. */
  emptyMessage?: string;
  /** When true (an Examples popup is open on top), the gate yields keyboard
   * control so it can't fight the popup's focus trap, and goes inert. */
  suspendKeyboard?: boolean;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const constraintsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
      if (e.key === "Escape") {
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
  }, [onClose, suspendKeyboard]);

  // React 18.3 needs `inert` spread as a string for Framer compatibility.
  const inertProps = suspendKeyboard
    ? ({ inert: "" } as Record<string, string>)
    : {};

  const grid = (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {tiles.map((tile) => {
        const isEmpty = !!tile.disabled;
        return (
          <div key={tile.key} className="flex flex-col gap-1">
            <button
              type="button"
              disabled={isEmpty}
              onClick={() => onSelect(tile.key)}
              onMouseEnter={() => setHovered(tile.key)}
              onMouseLeave={() => setHovered(null)}
              aria-label={tile.ariaLabel ?? tile.label}
              className={[
                "relative flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-modal border p-2 transition-colors",
                isEmpty
                  ? "cursor-not-allowed border-white/10 opacity-35"
                  : hovered === tile.key
                    ? "border-teal-400 bg-teal-500/20 text-teal-300"
                    : "border-white/15 bg-white/5 text-teal-500 hover:border-teal-400 hover:bg-teal-500/20 hover:text-teal-300",
              ].join(" ")}
            >
              {tile.media ? (
                <span className="block aspect-square w-full overflow-hidden rounded-modal bg-white/5">
                  {tile.media}
                </span>
              ) : (
                <span className="flex h-8 w-8 items-center justify-center">
                  {tile.icon}
                </span>
              )}
              <span className="text-center text-[10px] font-semibold uppercase leading-tight tracking-wider text-white/70">
                {tile.label}
              </span>
              {!!tile.badge && tile.badge > 0 && (
                <span className="absolute right-1.5 top-1.5 rounded-full bg-teal-600/80 px-1 text-[10px] font-bold text-white">
                  {tile.badge}
                </span>
              )}
            </button>
            {tile.extra}
          </div>
        );
      })}
    </div>
  );

  return (
    <div ref={constraintsRef} className="pointer-events-none absolute inset-0 z-30">
      <div className="pointer-events-none absolute left-1/2 top-1/2 w-[min(32rem,calc(100%-1.5rem))] -translate-x-1/2 -translate-y-1/2">
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
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: DURATION.standard, ease: EASE.enter }
          }
          className="pointer-events-auto relative rounded-card border border-white/12 bg-navy-900/95 px-4 pb-4 pt-7 shadow-menu backdrop-blur"
          style={{ paddingBottom: `max(1rem, env(safe-area-inset-bottom))` }}
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

          {/* Back to the previous rung (top-left). Omitted on Rung 1. */}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to the previous step"
              title="Back a step"
              className="absolute left-2 top-1 inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-white/10 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/80 hover:bg-white/20 hover:text-white"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M11 7H3M7 11L3 7l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back
            </button>
          )}

          {/* Hide back to the video (top-right). */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Hide and go back to the video"
            title="Back to the video"
            className="absolute right-2 top-1 inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-white/10 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/80 hover:bg-white/20 hover:text-white"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 7h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M7 11l-3.5-4L7 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Hide
          </button>

          <div>
            <p className="mb-1 text-center text-[11px] font-semibold uppercase tracking-widest text-white/50">
              {title}
            </p>

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
                      <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/45">
                        {c.label}
                      </span>
                    )}
                  </span>
                ))}
              </nav>
            )}

            {tiles.length === 0 && emptyMessage ? (
              <p className="px-2 py-6 text-center text-sm text-white/60">{emptyMessage}</p>
            ) : scrollable ? (
              <div className="-mx-1 max-h-[46vh] overflow-y-auto px-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15">
                {grid}
              </div>
            ) : (
              grid
            )}

            {(notSure || skip) && (
              <div className="mt-3 flex items-center justify-between">
                {notSure ? (
                  <button
                    type="button"
                    onClick={notSure.onClick}
                    className="inline-flex min-h-[44px] items-center px-2 -mx-2 text-[10px] uppercase tracking-wider text-white/45 hover:text-white/80"
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
      </div>
    </div>
  );
}
