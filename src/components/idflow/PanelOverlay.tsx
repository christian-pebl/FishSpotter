"use client";

/**
 * A dialog that lands on the WORKING HALF of the split screen instead of over
 * the whole app.
 *
 * The comparison, the species card and the map were all `fixed inset-0`
 * overlays with a full-bleed scrim. Opened from a split feed that was actively
 * wrong: the scrim dimmed the clip, the card straddled the seam, and the
 * animal you were trying to identify went dark at exactly the moment you were
 * comparing two candidates against it. "Is it the edible or the shore crab?" is
 * unanswerable with the crab greyed out.
 *
 * So: when a split is open the dialog fills the working half exactly (flush,
 * square, no scrim, the clip half untouched and still playing). When nothing is
 * split it falls back to the centred card it has always been, because
 * `--fs-panel-*` is unset and `PANEL_FRAME_STYLE`'s fallbacks resolve to the
 * whole viewport.
 *
 * Focus management stays with each caller: `SpeciesGuidePopup` has to keep its
 * lightbox-aware Escape guard, and folding that in here would either lose it or
 * force every caller to carry it.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PANEL_FRAME_STYLE, useSplitFrame } from "@/lib/split-screen";

export function PanelOverlay({
  dialogRef,
  ariaLabel,
  onDismiss,
  surfaceClassName,
  children,
}: {
  /** The caller's dialog element, so it keeps ownership of focus + Tab trap. */
  dialogRef?: React.MutableRefObject<HTMLDivElement | null>;
  ariaLabel: string;
  /** Backdrop click. Only wired when there IS a backdrop, i.e. off-split. */
  onDismiss?: () => void;
  /** Surface colours (background, text). Layout is this component's business. */
  surfaceClassName: string;
  children: React.ReactNode;
}) {
  const split = useSplitFrame();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;

  const inSplit = split.open;

  return createPortal(
    <div
      style={PANEL_FRAME_STYLE}
      className={[
        "z-[90] flex",
        inSplit
          ? // Exactly the working half. No scrim: there is nothing behind it
            // worth dimming, and a scrim here would bleed onto the clip.
            "items-stretch justify-stretch"
          : "items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4",
      ].join(" ")}
      onMouseDown={
        inSplit || !onDismiss
          ? undefined
          : (e) => {
              if (e.target === e.currentTarget) onDismiss();
            }
      }
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={[
          "flex flex-col overflow-hidden",
          inSplit
            ? // Flush with the seam, like the panel it replaces.
              "h-full w-full"
            : "max-h-[92dvh] w-full max-w-xl rounded-t-card shadow-menu sm:rounded-card",
          surfaceClassName,
        ].join(" ")}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
