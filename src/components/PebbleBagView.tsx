"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  animate,
  useAnimationControls,
  useReducedMotion,
} from "framer-motion";

/**
 * The pouch and its collect-into-bag animation. Split from `PebbleBag.tsx` (the
 * live container) because this is the part that needs framer-motion, and the
 * container is in the header of every page: the container loads this on demand,
 * and only for a signed-in spotter, so a first visit never downloads the
 * animation library for a bag it will not show.
 */

const overlayTextShadow = "0 1px 3px rgba(0,0,0,0.55)";

type FlyingPebble = {
  id: number;
  startX: number;
  startY: number;
  size: number;
  rotate: number;
};

type Burst = { id: number; pebbles: FlyingPebble[] };

/** A "collect" signal, bump `nonce` to fire a fresh fly-in burst. */
export interface PebbleEarn {
  earned: number;
  firstSighting: boolean;
  nonce: number;
}

/** A single minimalist outline pebble, inherits colour via currentColor. */
function PebbleGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.6" y="4.2" width="12.8" height="7.6" rx="3.8" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/** A minimalist outline cairn, three balanced pebbles, the PEBL stack. */
function Cairn({ onFeed }: { onFeed: boolean }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ opacity: 0.5, ...(onFeed ? { filter: `drop-shadow(${overlayTextShadow})` } : {}) }}
    >
      <g stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <rect x="7.5" y="2" width="9" height="5" rx="2.5" />
        <rect x="5" y="8.8" width="14" height="6.2" rx="3.1" />
        <rect x="3" y="16.6" width="18" height="6.4" rx="3.2" />
      </g>
    </svg>
  );
}

/**
 * Presentational pouch with the collect-into-bag animation. Stateless about WHERE
 * Pebbles come from, driven entirely by `total` (animated count-up) and `earn`
 * (a nonce-bumped signal that fires a fly-in burst). Reused by the live container
 * and the Storybook story, so the animation can be watched/tuned in isolation.
 *
 * Smoothness contract: every animated property is transform (x/y/scale/rotate) or
 * opacity (compositor-only, no layout thrash) and the whole thing collapses to a
 * plain count-up under prefers-reduced-motion.
 */
export function PebbleBagView({
  total,
  onFeed,
  earn,
}: {
  total: number;
  onFeed: boolean;
  earn?: PebbleEarn | null;
}) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(total);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const pouchControls = useAnimationControls();
  const displayRef = useRef(total);
  const burstSeq = useRef(0);
  const lastNonce = useRef<number | null>(null);

  // Count-up toward the authoritative total whenever it changes.
  useEffect(() => {
    const from = displayRef.current;
    displayRef.current = total;
    if (reduceMotion || from === total) {
      setDisplay(total);
      return;
    }
    const controls = animate(from, total, {
      duration: 0.6,
      delay: 0.25,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [total, reduceMotion]);

  // Fire a fly-in burst + pouch "plump" when a new earn signal arrives.
  useEffect(() => {
    if (!earn || earn.nonce === lastNonce.current) return;
    lastNonce.current = earn.nonce;
    if (reduceMotion || earn.earned <= 0) return;

    // Keep it subtle: 2 pebbles for a normal sighting, up to 4 for a First
    // Sighting, in a tight spread with gentle rotation.
    const n = Math.min(earn.firstSighting ? 4 : 2, Math.max(1, Math.round(earn.earned / 10)));
    const pebbles: FlyingPebble[] = Array.from({ length: n }, (_, i) => ({
      id: burstSeq.current * 100 + i,
      startX: -9 + Math.random() * 18,
      startY: -22 - Math.random() * 5,
      size: 8 + Math.random() * 2.5,
      rotate: -22 + Math.random() * 44,
    }));
    const burst: Burst = { id: burstSeq.current++, pebbles };
    setBursts((b) => [...b, burst]);
    pouchControls.start({
      scale: [1, 1.1, 1],
      transition: { duration: 0.42, times: [0, 0.45, 1], ease: "easeOut", delay: 0.16 },
    });
    const t = window.setTimeout(
      () => setBursts((b) => b.filter((x) => x.id !== burst.id)),
      1000,
    );
    return () => window.clearTimeout(t);
  }, [earn, reduceMotion, pouchControls]);

  return (
    <span
      className={`relative inline-flex items-center gap-1.5 ${
        onFeed ? "text-white/90" : "text-teal-700"
      }`}
    >
      <span className="relative inline-flex">
        <motion.span animate={pouchControls} className="inline-flex">
          <Cairn onFeed={onFeed} />
        </motion.span>
        {/* Fly-in burst layer, absolutely centred over the pouch. */}
        <span className="pointer-events-none absolute left-1/2 top-1/2">
          {bursts.map((burst) =>
            burst.pebbles.map((p, i) => (
              <motion.span
                key={`${burst.id}-${p.id}`}
                className="absolute"
                initial={{ x: p.startX, y: p.startY, opacity: 0, scale: 0.9, rotate: p.rotate }}
                animate={{
                  x: [p.startX, p.startX * 0.3, 0],
                  y: [p.startY, p.startY + 8, 2],
                  opacity: [0, 1, 1, 0],
                  scale: [0.9, 1, 0.25],
                  rotate: p.rotate * 0.4,
                }}
                transition={{ duration: 0.7, delay: i * 0.06, ease: "easeIn", times: [0, 0.5, 1] }}
                style={{ marginLeft: -p.size / 2, marginTop: -p.size / 2 }}
              >
                <PebbleGlyph size={p.size} />
              </motion.span>
            )),
          )}
        </span>
      </span>
      <span
        className={`min-w-[1.5ch] text-sm font-semibold tabular-nums opacity-80 ${
          onFeed ? "text-white/90" : "text-teal-700"
        }`}
        style={onFeed ? { textShadow: overlayTextShadow } : undefined}
      >
        {display.toLocaleString()}
      </span>
    </span>
  );
}
