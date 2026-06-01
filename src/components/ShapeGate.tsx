"use client";

/**
 * UX-0: The "Spot It" shape-class gate.
 *
 * An 8-tile silhouette grid shown as a bottom sheet over the looping clip.
 * Tapping a tile sets shapeClass and shows the live candidate count from
 * narrowCandidates(). "Skip to guess" closes the gate to the MCQ fast path.
 * "Not sure" activates the strip with no shape filter (narrows the whole
 * catalogue) rather than dead-ending — the murky-safe path.
 *
 * Assets: placeholder inline SVGs in brand teal — swap for PhyloPic art in
 * Workstream D / UX-5.
 */

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { narrowCandidates } from "@/lib/idguide/narrow";
import { SHAPE_CLASS, type ShapeClass } from "@/lib/idguide/traits";
import speciesTraitsData from "@/data/species-traits.json";
import type { SpeciesCatalogue } from "@/lib/idguide/traits";
import { DURATION, EASE } from "@/lib/motion";

const CATALOGUE = speciesTraitsData as unknown as SpeciesCatalogue;

// ---------------------------------------------------------------------------
// Placeholder silhouettes — one inline SVG per shape class.
// All are single-path stroked art in `currentColor` so they inherit the
// parent's text-teal-500 class. Replace with PhyloPic SVGs in UX-5.
// ---------------------------------------------------------------------------

function SilFish() {
  return (
    <svg viewBox="0 0 48 32" fill="none" aria-hidden="true" className="w-full h-full">
      <path d="M6 16c3-7 9-11 16-11 9 0 16 5 19 11-3 6-10 11-19 11-7 0-13-4-16-11z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M41 16l6-5v10l-6-5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <circle cx="13" cy="14" r="1.5" fill="currentColor"/>
    </svg>
  );
}

function SilFlatfish() {
  return (
    <svg viewBox="0 0 52 28" fill="none" aria-hidden="true" className="w-full h-full">
      <ellipse cx="24" cy="14" rx="22" ry="10" stroke="currentColor" strokeWidth="2"/>
      <path d="M44 14l7-4v8l-7-4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <circle cx="10" cy="11" r="1.5" fill="currentColor"/>
      <path d="M8 20q8 3 16 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

function SilCrab() {
  return (
    <svg viewBox="0 0 52 36" fill="none" aria-hidden="true" className="w-full h-full">
      <rect x="14" y="10" width="24" height="16" rx="6" stroke="currentColor" strokeWidth="2"/>
      <path d="M14 18L4 12M14 18L4 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M38 18L48 12M38 18L48 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M20 26L17 34M26 26L26 34M32 26L35 34" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="20" cy="14" r="2" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="32" cy="14" r="2" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function SilScooter() {
  return (
    <svg viewBox="0 0 52 32" fill="none" aria-hidden="true" className="w-full h-full">
      <ellipse cx="24" cy="20" rx="20" ry="8" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 20L8 10M24 20L24 8M36 20L40 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M16 9l16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="16" cy="21" r="1.5" fill="currentColor"/>
    </svg>
  );
}

function SilJellyfish() {
  return (
    <svg viewBox="0 0 40 44" fill="none" aria-hidden="true" className="w-full h-full">
      <path d="M4 18C4 9 10 4 20 4s16 5 16 14" stroke="currentColor" strokeWidth="2"/>
      <path d="M4 18q4 4 16 4t16-4" stroke="currentColor" strokeWidth="2"/>
      <path d="M10 22q-1 8-3 18M16 22q0 9 0 18M20 22q0 9 2 18M24 22q1 9 4 18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

function SilStarfish() {
  return (
    <svg viewBox="0 0 44 44" fill="none" aria-hidden="true" className="w-full h-full">
      <path d="M22 4l3 11h11l-9 7 3 11-8-6-8 6 3-11-9-7h11z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    </svg>
  );
}

function SilGastropod() {
  return (
    <svg viewBox="0 0 44 36" fill="none" aria-hidden="true" className="w-full h-full">
      <path d="M22 8c-8 0-14 5-14 11s6 11 14 11c6 0 11-4 11-9s-4-8-9-8-8 3-8 7 3 6 7 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M8 30l-4 4M10 30l-2 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function SilSquid() {
  return (
    <svg viewBox="0 0 36 52" fill="none" aria-hidden="true" className="w-full h-full">
      <path d="M18 4c-6 0-10 4-10 10v12c0 4 4 7 10 7s10-3 10-7V14C28 8 24 4 18 4z" stroke="currentColor" strokeWidth="2"/>
      <path d="M8 33q-4 6-5 14M11 34q-2 7-2 14M18 34v14M25 34q2 7 2 14M28 33q4 6 5 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M10 14l-6-4M26 14l6-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

const TILES: { key: ShapeClass; label: string; Icon: () => JSX.Element }[] = [
  { key: "fish",       label: "Fish",       Icon: SilFish },
  { key: "flatfish",   label: "Flatfish",   Icon: SilFlatfish },
  { key: "crab",       label: "Crab",       Icon: SilCrab },
  { key: "scooter",    label: "Scooter",    Icon: SilScooter },
  { key: "jellyfish",  label: "Jellyfish",  Icon: SilJellyfish },
  { key: "starfish",   label: "Starfish",   Icon: SilStarfish },
  { key: "gastropod",  label: "Snail / slug", Icon: SilGastropod },
  { key: "squid",      label: "Squid",      Icon: SilSquid },
];

// ---------------------------------------------------------------------------

export function ShapeGate({
  onSelectShape,
  onSkip,
  onClose,
}: {
  /** Called when the user taps a shape tile. Passes null when "Not sure" is tapped. */
  onSelectShape: (shape: ShapeClass | null) => void;
  /** Called when the user taps "Skip to ID guide". */
  onSkip: () => void;
  onClose: () => void;
}) {
  const [hovered, setHovered] = useState<ShapeClass | null>(null);

  const candidateCounts = useMemo(() => {
    const out: Partial<Record<ShapeClass, number>> = {};
    for (const sc of SHAPE_CLASS) {
      // limit: 100 so the tile badge shows the TRUE count — narrowCandidates
      // defaults to 12, which undercounted the 26-species fish tile as "12".
      out[sc] = narrowCandidates({ catalogue: CATALOGUE, shapeClass: sc, limit: 100 }).length;
    }
    return out;
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        key="shape-gate-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: DURATION.micro, ease: EASE.enter }}
        className="absolute inset-0 z-30 flex flex-col justify-end"
        style={{ background: "linear-gradient(to top, rgba(23,37,42,0.96) 60%, rgba(23,37,42,0.55) 100%)" }}
        role="dialog"
        aria-modal="true"
        aria-label="What shape is it?"
      >
        {/* Close / back affordance */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close shape selector"
          className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-white/50 hover:text-white/90"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>

        <div className="px-4 pb-4 pt-2" style={{ paddingBottom: `max(1rem, env(safe-area-inset-bottom))` }}>
          <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-widest text-white/50">
            What shape is it, roughly?
          </p>

          {/* 4 × 2 silhouette grid */}
          <div className="grid grid-cols-4 gap-2">
            {TILES.map(({ key, label, Icon }) => {
              const count = candidateCounts[key] ?? 0;
              const isEmpty = count === 0;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={isEmpty}
                  onClick={() => onSelectShape(key)}
                  onMouseEnter={() => setHovered(key)}
                  onMouseLeave={() => setHovered(null)}
                  aria-label={`${label}${count > 0 ? `, ${count} species` : ", none in catalogue yet"}`}
                  className={[
                    "relative flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-modal border p-2 transition-colors",
                    isEmpty
                      ? "cursor-not-allowed border-white/10 opacity-35"
                      : hovered === key
                        ? "border-teal-400 bg-teal-500/20 text-teal-300"
                        : "border-white/15 bg-white/5 text-teal-500 hover:border-teal-400 hover:bg-teal-500/20 hover:text-teal-300",
                  ].join(" ")}
                >
                  <span className="h-8 w-8">
                    <Icon />
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                    {label}
                  </span>
                  {count > 0 && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-teal-600/80 px-1 text-[10px] font-bold text-white">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Not sure + skip row */}
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onSelectShape(null)}
              className="inline-flex min-h-[44px] items-center px-2 -mx-2 text-[10px] uppercase tracking-wider text-white/45 hover:text-white/80"
            >
              Not sure
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="inline-flex min-h-[44px] items-center px-2 -mx-2 text-[10px] uppercase tracking-wider text-teal-400/80 hover:text-teal-300"
            >
              Skip to guess →
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
