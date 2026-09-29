"use client";

import { motion, useReducedMotion } from "framer-motion";
import { DURATION, EASE } from "@/lib/motion";
import type { AnchorRect } from "./useAnchorRect";

const MASK_ID = "fs-tour-spotlight-mask";

/**
 * The first-run tour's dim layer: everything outside the current target is
 * greyed back, the target itself is left at full brightness inside a rounded
 * cut-out with a teal ring.
 *
 * Implemented as one SVG with a mask (a white full-bleed rect minus a black
 * rounded rect) rather than four dim panels around the hole. The mask is a
 * single animatable element, so moving the spotlight from the clip, to the tile
 * grid, to the header pebble bag reads as one shape travelling rather than four
 * rectangles resizing independently.
 *
 * DELIBERATELY NOT MODAL. The whole layer is `pointer-events: none`, including
 * the dim, so every real control stays clickable underneath. A tour that points
 * at the live app must not stop the user reaching the gate's own Back, Close or
 * "Skip to guess" controls, and blocking taps would strand anyone who wandered
 * off the suggested path. Divergence is handled by the controller instead: the
 * tour follows the app wherever it goes (see src/lib/tour-bus.ts).
 */
export function Spotlight({
  rect,
  radius = 18,
  padding = 8,
}: {
  /** Viewport rect of the element to keep lit. Null dims the whole screen. */
  rect: AnchorRect | null;
  radius?: number;
  padding?: number;
}) {
  const reduce = useReducedMotion();

  // No target yet (a gate still animating in): dim everything rather than
  // flashing an un-dimmed frame, and let the hole fade in when it resolves.
  const hole = rect
    ? {
        x: rect.left - padding,
        y: rect.top - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      }
    : { x: 0, y: 0, width: 0, height: 0 };

  const transition = reduce
    ? { duration: 0 }
    : { duration: DURATION.layout, ease: EASE.layout };

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[110] h-full w-full"
      width="100%"
      height="100%"
    >
      <defs>
        <mask id={MASK_ID}>
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <motion.rect
            initial={false}
            animate={{ x: hole.x, y: hole.y, width: hole.width, height: hole.height }}
            transition={transition}
            rx={radius}
            ry={radius}
            fill="black"
          />
        </mask>
      </defs>

      {/* Navy 900 at 74%, the same ground the gates sit on, so the dimmed app
          reads as "behind the tour" rather than as a grey wash. */}
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="rgba(23, 37, 42, 0.74)"
        mask={`url(#${MASK_ID})`}
      />

      {/* The ring. Separate from the mask so it can carry its own colour and a
          soft pulse without punching a second hole. */}
      {rect && (
        <motion.rect
          initial={false}
          animate={{
            x: hole.x,
            y: hole.y,
            width: hole.width,
            height: hole.height,
            opacity: reduce ? 0.9 : [0.55, 0.95, 0.55],
          }}
          transition={{
            ...transition,
            opacity: reduce
              ? { duration: 0 }
              : { duration: 2.4, repeat: Infinity, ease: "easeInOut" },
          }}
          rx={radius}
          ry={radius}
          fill="none"
          stroke="#3AAFA9"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}
