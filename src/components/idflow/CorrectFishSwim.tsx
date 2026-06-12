"use client";

/**
 * Correct-answer line-fish swim-by: a subtle reward flourish.
 *
 * On a CORRECT reveal only, a single thin teal stroked line-fish (the same
 * low-detail `currentColor` silhouette level as the ShapeGate fish) darts once
 * across the reveal area, left to right, with a tiny rotate "wiggle", then
 * unmounts (~0.9s total). It is deliberately faint and `pointer-events-none`,
 * sitting BEHIND the result text so it never obscures the score.
 *
 * Reduced motion: renders nothing (the flourish is pure decoration; the
 * RevealResult headline already conveys the outcome statically, so there is no
 * information to preserve here, and a frozen fish mid-screen would just be
 * visual noise).
 *
 * Mount this only when `isCorrect === true`. It self-unmounts on completion via
 * an internal `done` flag so no perpetual motion lingers in the DOM.
 */

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

export function CorrectFishSwim({
  /** Allows the host (and the story) to force the reduced-motion path. */
  reduceMotion,
}: {
  reduceMotion?: boolean;
}) {
  const systemReduce = useReducedMotion();
  const reduce = reduceMotion ?? systemReduce ?? false;

  // Once the dart finishes, drop the node entirely (one-shot, not perpetual).
  const [done, setDone] = useState(false);

  // Reduced motion -> render nothing (decorative only; the verdict text carries
  // the outcome). Also stop rendering after the single pass completes.
  if (reduce || done) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {/* The fish travels in container-relative units (-20% -> 120%) so it
          enters and exits fully off either edge regardless of panel width.
          Vertical position is the upper third so it stays clear of the
          two result panels lower down. Bespoke 0.9s one-shot timing (a tuned
          swim-by, not a generic enter/exit tier), so it stays inline. */}
      <motion.div
        className="absolute left-0 top-[18%] text-teal-400/35"
        initial={{ x: "-22%", rotate: -4, opacity: 0 }}
        animate={{
          x: ["-22%", "20%", "120%"],
          rotate: [-4, 5, -3, 4, 0],
          opacity: [0, 0.9, 0.9, 0],
        }}
        transition={{
          duration: 0.9,
          ease: "easeInOut",
          times: [0, 0.18, 0.85, 1],
        }}
        onAnimationComplete={() => setDone(true)}
        style={{ willChange: "transform, opacity" }}
      >
        <LineFish />
      </motion.div>
    </div>
  );
}

/**
 * Minimal three-path fish in `currentColor`, matched to the ShapeGate
 * `SilFish` level of detail (body, tail, eye). `fill="none"`, single confident
 * stroke, rounded joins.
 */
function LineFish() {
  return (
    <svg
      viewBox="0 0 48 32"
      fill="none"
      aria-hidden="true"
      className="h-7 w-auto"
    >
      <path
        d="M6 16c3-7 9-11 16-11 9 0 16 5 19 11-3 6-10 11-19 11-7 0-13-4-16-11z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M41 16l6-5v10l-6-5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="13" cy="14" r="1.5" fill="currentColor" />
    </svg>
  );
}
