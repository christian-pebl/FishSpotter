"use client";

/**
 * The working half of the split screen, as a reusable shell.
 *
 * `TileGate` grew this chrome for the rung tiles: a panel docked to the left
 * edge on a wide screen, a bottom sheet on a phone, flush to the frame with no
 * gutter and no corner radius so it reads as an OS-style split rather than a
 * floating window, with one drag control that RESIZES it (seam edge on
 * desktop, top grip on a phone) and a live `fs-gate` broadcast so the clip is
 * resized into what is left.
 *
 * The reveal needed exactly the same thing, so it lives here rather than being
 * copied. `TileGate` keeps its own copy of the markup for now (it is welded to
 * its minimise-to-a-bubble animation); the two cannot drift on GEOMETRY because
 * both take it from `@/lib/split-screen`.
 *
 * Deliberately NOT a modal: `aria-modal="false"`, no focus trap, no body-scroll
 * lock. The clip beside it is live and the whole point is that you can look at
 * it, so trapping the user in the panel would fight the layout.
 */

import { useRef } from "react";
import {
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

export function SplitPanel({
  ariaLabel,
  children,
  className = "",
  onFullVideo,
  fullVideoLabel = "Full video",
}: {
  ariaLabel: string;
  children: React.ReactNode;
  /** Extra classes for the panel surface (padding is the caller's business). */
  className?: string;
  /** Phone-only escape to the clip, mirroring the gate's "Full video". Omit to
   *  hide it when the caller has its own hide affordance. */
  onFullVideo?: () => void;
  fullVideoLabel?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const docked = useDocked();
  const { widthPct, setWidthPct, heightPct, setHeightPct } = useStoredSplitSize();
  const { resizing, startResize, onResizeKey } = useSplitResize({
    docked,
    widthPct,
    heightPct,
    setWidthPct,
    setHeightPct,
    panelRef,
    trackRef,
  });

  useSplitPanel(panelRef, { open: true, docked, widthPct, heightPct });

  return (
    <div
      ref={trackRef}
      className={[
        "pointer-events-none absolute inset-0 z-20 flex",
        // pt-14 when docked keeps the panel clear of the feed's transparent
        // overlay header (the menu button + wordmark, z-40, which paints over
        // this panel).
        docked ? "items-stretch justify-start pt-14" : "items-end justify-center",
      ].join(" ")}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-label={ariaLabel}
        className={[
          "pointer-events-auto relative flex max-h-full flex-col overflow-hidden bg-navy-900 shadow-menu",
          docked ? "h-full border-r border-white/12" : "w-full border-t border-white/12",
          resizing ? "select-none" : "",
          className,
        ].join(" ")}
        style={{
          ...(docked
            ? { width: `${widthPct}%`, minWidth: `${MIN_WIDTH_REM}rem`, maxWidth: `${MAX_WIDTH_PCT}%` }
            : { height: `${heightPct}%` }),
        }}
      >
        {/* Sheet grip: drag down and the sheet shrinks live under the finger,
            uncovering the clip above. Full-width 28px strip so it is grabbable
            without aiming. */}
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
            className="group absolute inset-x-0 top-0 z-20 flex h-7 cursor-ns-resize touch-none items-center justify-center text-white/35 hover:text-white/70 focus:outline-none focus-visible:text-teal-300 active:cursor-grabbing"
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

        {onFullVideo && !docked && (
          <button
            type="button"
            onClick={onFullVideo}
            className="absolute right-2 top-0 z-30 inline-flex h-7 items-center gap-1 rounded-full px-2 text-[10px] font-semibold uppercase tracking-wider text-teal-300/90 hover:text-teal-200"
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
            {fullVideoLabel}
          </button>
        )}

        {/* Resize edge (docked): drag the seam to set how much of the clip the
            panel covers. */}
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
            className="group absolute inset-y-0 -right-1.5 z-30 flex w-3 cursor-col-resize touch-none items-center justify-center focus:outline-none"
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

        {children}
      </div>
    </div>
  );
}
