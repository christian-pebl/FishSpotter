"use client";

/**
 * TileGate — the reusable "Spot It" gate chrome.
 *
 * Extracted from ShapeGate (3 Jun) so Rung 1 (shape class) and Rung 2 (body
 * shape) share one draggable, dark, silhouette-tiled card. It owns:
 *   - the non-covering floating card (clip keeps playing/visible behind it),
 *   - drag-from-the-grip-handle only (so tiles stay tappable),
 *   - the modal a11y (focus grab, Escape, Tab trap, body-scroll lock, focus
 *     restore) — mirrors IdGuideSheet/SideMenu,
 *   - a "Hide" affordance back to the video,
 *   - a tile grid + optional "Not sure" / "Skip to guess" footer.
 *
 * Each tile is a select button (icon + label + optional count badge) with an
 * optional `extra` node rendered beneath it (Rung 2 uses this for the "Examples"
 * button). The caller supplies the icon node, so TileGate stays agnostic about
 * mask-image silhouettes vs inline fallbacks.
 */

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useDragControls } from "framer-motion";
import { DURATION, EASE } from "@/lib/motion";

/** A teal-tinted silhouette from a static SVG, via CSS mask + bg-current (zero
 * JS-bundle cost, hover-recolours with the tile). Shared by both rungs. */
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
  /** The silhouette node — rendered inside an 8×8 area. */
  icon: React.ReactNode;
  /** Optional node under the select button (Rung 2: the "Examples" button). */
  extra?: React.ReactNode;
  ariaLabel?: string;
};

export function TileGate({
  ariaLabel,
  title,
  tiles,
  columns = 4,
  onSelect,
  onClose,
  notSure,
  skip,
  suspendKeyboard = false,
}: {
  ariaLabel: string;
  title: string;
  tiles: TileSpec[];
  columns?: number;
  onSelect: (key: string) => void;
  onClose: () => void;
  notSure?: { label: string; onClick: () => void };
  skip?: { label: string; onClick: () => void };
  /** When true (e.g. an Examples popup is open on top), the gate yields keyboard
   * control: it skips its own Escape/Tab handling so it can't fight the popup's
   * focus trap, and goes inert so clicks fall to the popup. */
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
            <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-widest text-white/50">
              {title}
            </p>

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
                      <span className="flex h-8 w-8 items-center justify-center">
                        {tile.icon}
                      </span>
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
