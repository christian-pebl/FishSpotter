import type { CSSProperties } from "react";

/**
 * Decorative, seamless marine-silhouette pattern (WhatsApp-doodle style),
 * tiled from public/patterns/marine-pattern.svg (built by
 * scripts/build-marine-pattern.cjs from the CC0 PhyloPic silhouettes).
 *
 * Uses the same mask-image + `background-color: currentColor` technique as
 * ShapeGate / UnderwaterBackdrop, so the silhouettes inherit the element's
 * text colour: set the tint + opacity via a Tailwind `text-*` class
 * (e.g. `text-teal-600/10`). Always decorative -> aria-hidden, no motion,
 * single hue (colourblind-safe), one cached image at effectively zero
 * runtime cost.
 */
const TILE_PX = 600;
// PNG, not the SVG source: the high-detail potrace paths are expensive to
// re-rasterise as a tiled CSS mask, whereas a pre-rendered PNG decodes once
// and GPU-tiles cheaply (rebuild both via scripts/build-marine-pattern.cjs).
const MASK = "url(/patterns/marine-pattern.png)";

const maskStyle: CSSProperties = {
  WebkitMaskImage: MASK,
  maskImage: MASK,
  WebkitMaskRepeat: "repeat",
  maskRepeat: "repeat",
  WebkitMaskSize: `${TILE_PX}px ${TILE_PX}px`,
  maskSize: `${TILE_PX}px ${TILE_PX}px`,
  backgroundColor: "currentColor",
};

export function MarinePattern({
  className = "",
  animated = false,
}: {
  className?: string;
  /** Gentle wave-like sway. The host is oversized (-inset-6) so the drift
   *  never reveals a tile edge, so the PARENT must be `overflow-hidden`. */
  animated?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute ${
        animated ? "-inset-6 fs-pattern-sway" : "inset-0"
      } ${className}`}
      style={maskStyle}
    />
  );
}
