"use client";

/**
 * Pokedex SPECIES-UNLOCK reveal (the celebration that fires when a spotter has
 * *just* added a species to their collection). Extracted into a client island so
 * `SpeciesCollection` (a server component) can stay server-rendered and only this
 * one tile animates.
 *
 * The moment (~0.8s, one-shot, on mount when `justUnlocked`):
 *   1. the grey silhouette dissolves out (opacity + a touch of scale),
 *   2. the real photo settles in over the top (fade + gentle scale settle), and
 *   3. a single thin teal shockwave ring expands once from the tile centre
 *      (matches the existing .fs-radar look — 2px teal border + a faint glow —
 *      but rendered as a one-shot Framer ring so we don't touch globals.css or
 *      borrow the infinite .fs-radar-ring keyframe).
 *
 * The per-shape-class badge tick-up lives in the sibling `ProgressBadge` below
 * (it is the same "+1" beat, but rendered up in the badge row, not on the tile).
 *
 * Reduced motion: render the unlocked photo + name statically, no dissolve, no
 * ring. The user loses only the flourish, never the information (the tile is
 * already, correctly, "collected").
 */

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { DURATION, EASE, spring } from "@/lib/motion";

export type UnlockTileProps = {
  /** Curated reference photo (iNat/Wikimedia thumb). Falls back to a name chip when absent. */
  photoUrl?: string;
  commonName: string;
  /** Species profile slug, e.g. "labrus-mixtus". */
  slug: string;
  /** Shape-class silhouette to dissolve FROM (e.g. "fish", "crab"). */
  shapeClass: string;
  /** When true, plays the dissolve+ring reveal once on mount. Otherwise static. */
  justUnlocked: boolean;
  /** Test/Storybook override; defaults to the OS prefers-reduced-motion setting. */
  reduceMotion?: boolean;
};

/**
 * The collected tile. Visually identical to the static unlocked tile that
 * `SpeciesCollection` rendered inline before — it just adds the reveal when
 * `justUnlocked` is set.
 */
export function UnlockTile({
  photoUrl,
  commonName,
  slug,
  shapeClass,
  justUnlocked,
  reduceMotion,
}: UnlockTileProps) {
  const osReduce = useReducedMotion();
  const reduce = reduceMotion ?? osReduce ?? false;
  const play = justUnlocked && !reduce;

  return (
    <li>
      <Link href={`/species/${slug}`} className="group block">
        <div className="relative aspect-square overflow-hidden rounded-modal bg-navy-900 ring-1 ring-teal-500/40">
          {photoUrl ? (
            <>
              {/* The real photo. Settles in (fade + gentle scale) over the
                  dissolving silhouette when freshly unlocked; otherwise just
                  sits there at rest. */}
              {/* eslint-disable-next-line @next/next/no-img-element -- external iNat thumb */}
              <motion.img
                src={photoUrl}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                initial={play ? { opacity: 0, scale: 0.85 } : false}
                animate={play ? { opacity: 1, scale: 1 } : undefined}
                transition={play ? { ...spring.cheer, delay: 0.18 } : undefined}
              />

              {/* The grey silhouette we dissolve FROM. Only mounted during the
                  reveal; it fades + scales up slightly, then is gone. */}
              {play && (
                <motion.div
                  className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface-muted"
                  aria-hidden="true"
                  initial={{ opacity: 1, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.08 }}
                  transition={{ duration: DURATION.standard, ease: EASE.exit, delay: 0.12 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- local silhouette asset */}
                  <img
                    src={`/silhouettes/${shapeClass}.svg`}
                    alt=""
                    aria-hidden="true"
                    className="h-1/2 w-1/2 object-contain opacity-20"
                  />
                </motion.div>
              )}
            </>
          ) : (
            <span className="flex h-full items-center justify-center text-[10px] text-white/60">
              {commonName}
            </span>
          )}

          {/* One-shot teal shockwave ring from the tile centre. Restrained, thin
              (2px), matches the .fs-radar look (teal border + faint glow) but is
              single-iteration. Pure transform/opacity, GPU-friendly. */}
          {play && <ShockwaveRing />}
        </div>
        <p className="mt-1 truncate text-[11px] font-medium text-navy-900" title={commonName}>
          {commonName}
        </p>
      </Link>
    </li>
  );
}

/**
 * A single teal ring that expands once from the tile centre, then fades. Thin
 * teal border + the named `shadow-glow` token (the same faint teal halo the
 * radar ping uses), scaled with transform only so it stays cheap. Fires once and
 * resolves to nothing — not perpetual, so no off-screen-pause needed.
 */
function ShockwaveRing() {
  return (
    <motion.span
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-1/2 h-1/2 w-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-teal-400 shadow-glow"
      initial={{ scale: 0.3, opacity: 0.9 }}
      animate={{ scale: 2.2, opacity: 0 }}
      // Bespoke one-shot shockwave timing: a touch longer + softer than the
      // generic layout token so the ring reads as a gentle pulse, not a snap.
      transition={{ duration: 0.7, ease: EASE.enter, delay: 0.1 }}
    />
  );
}

export type ProgressBadgeProps = {
  /** Shape-class label as shown, e.g. "Fish". */
  label: string;
  /** Collected count AFTER the unlock (the value to land on). */
  unlocked: number;
  /** Total species in the class. */
  total: number;
  /** When true, the count rolls up from `unlocked - 1` to `unlocked` once. */
  justTicked: boolean;
  reduceMotion?: boolean;
};

/**
 * The per-shape-class progress badge ("Fish 3/8"). For the class that just had a
 * species unlocked, the numerator ticks up by one (rolls from n-1 to n) and the
 * badge gives a tiny scale pop. Everywhere else it renders the final value flat.
 *
 * The "done" check / styling mirror the inline badge in `SpeciesCollection` so
 * the two paths stay visually identical.
 */
export function ProgressBadge({
  label,
  unlocked,
  total,
  justTicked,
  reduceMotion,
}: ProgressBadgeProps) {
  const osReduce = useReducedMotion();
  const reduce = reduceMotion ?? osReduce ?? false;
  const animate = justTicked && !reduce && unlocked > 0;

  const n = useCountTo(unlocked, animate ? unlocked - 1 : unlocked, !animate);
  const done = unlocked === total;

  return (
    <motion.span
      className={
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium " +
        (done ? "bg-teal-500/15 text-teal-700" : "bg-surface-muted text-navy-900/70")
      }
      initial={animate ? { scale: 0.92 } : false}
      animate={animate ? { scale: 1 } : undefined}
      transition={animate ? spring.cheer : undefined}
    >
      {label} <span className="tabular-nums">{n}</span>/{total}
      {done && (
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
          <path
            d="M2 6.5l2.5 2.5L10 3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </motion.span>
  );
}

/**
 * Interpolate an integer from `from` -> `target` once via rAF (pattern 6 from
 * the motion library). `instant` (or reduced motion / no change) lands on the
 * target immediately. Every displayed frame is rounded.
 */
function useCountTo(target: number, from: number, instant: boolean, ms = 600) {
  const [n, setN] = useState(instant ? target : from);
  const startedRef = useRef(false);

  useEffect(() => {
    if (instant || startedRef.current || from === target) {
      setN(target);
      return;
    }
    startedRef.current = true;
    let raf = 0;
    let t0 = 0;
    const tick = (t: number) => {
      if (!t0) t0 = t;
      const k = Math.min((t - t0) / ms, 1);
      setN(Math.round(from + (target - from) * k));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, from, instant]);

  return n;
}
