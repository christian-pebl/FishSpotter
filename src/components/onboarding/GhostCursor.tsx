"use client";

import { motion, useReducedMotion } from "framer-motion";
import { DURATION, EASE } from "@/lib/motion";

/**
 * The tour's demonstrating cursor: an arrow that travels to the control the
 * current step is pointing at and mimes the gesture the user is about to make.
 *
 * Two modes:
 *  - `click`  travels to the point, presses (a quick scale-down) and rings once.
 *  - `scroll` travels, then makes a short repeated downward drag, for the beats
 *             where the gesture is "swipe through these" rather than "tap this"
 *             (the look-alike row, the species page).
 *
 * It is a demonstration, never a substitute: the user still makes the real tap
 * on the real control. So the whole thing is `pointer-events: none` and it
 * renders nothing at all under `prefers-reduced-motion` (a cursor that moves on
 * its own is exactly the kind of unrequested motion that invariant exists for).
 *
 * The arrow glyph is the one the previous tour preview used, kept so the tour's
 * visual language did not change under users mid-rollout.
 */
export function GhostCursor({
  point,
  mode = "click",
}: {
  /** Viewport coordinates to travel to. Null hides the cursor. */
  point: { x: number; y: number } | null;
  mode?: "click" | "scroll";
}) {
  const reduce = useReducedMotion();
  if (reduce || !point) return null;

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed z-[112] -translate-x-1/2 -translate-y-1/2"
      initial={{ opacity: 0, left: point.x, top: point.y }}
      animate={{
        opacity: 1,
        left: point.x,
        // Scroll mode nudges down and back, the "swipe through these" mime.
        top: mode === "scroll" ? [point.y, point.y + 46, point.y] : point.y,
      }}
      exit={{ opacity: 0 }}
      transition={{
        left: { duration: DURATION.layout, ease: EASE.layout },
        opacity: { duration: DURATION.micro },
        top:
          mode === "scroll"
            ? { duration: 1.9, repeat: Infinity, repeatDelay: 0.5, ease: "easeInOut" }
            : { duration: DURATION.layout, ease: EASE.layout },
      }}
    >
      {/* The press ripple, click mode only: one expanding teal ring on a loop,
          so the "tap here" reads even if the user looks up mid-cycle. */}
      {mode === "click" && (
        <motion.span
          className="absolute left-0 top-0 block h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-teal-300"
          initial={{ opacity: 0.85, scale: 0.4 }}
          animate={{ opacity: 0, scale: 1.6 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: EASE.exit }}
        />
      )}
      <motion.svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="white"
        style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}
        animate={mode === "click" ? { scale: [1, 0.82, 1] } : { scale: 1 }}
        transition={
          mode === "click"
            ? { duration: 1.4, repeat: Infinity, times: [0, 0.12, 0.3], ease: EASE.enter }
            : { duration: 0 }
        }
      >
        <path d="M4 2l14 8-6 2 3 7-3 1-3-7-5 4z" />
      </motion.svg>
    </motion.div>
  );
}
