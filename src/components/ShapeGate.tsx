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
 * Assets (UX-5): real PhyloPic silhouettes (CC0 / Public Domain, fetched by
 * scripts/fetch-silhouettes.cjs into public/silhouettes/; credits in
 * src/data/silhouette-credits.json). The hand-drawn inline SVGs below remain
 * as a fallback for any class the fetch can't resolve.
 */

import { useMemo } from "react";
import { narrowCandidates } from "@/lib/idguide/narrow";
import { SHAPE_CLASS, type ShapeClass } from "@/lib/idguide/traits";
import speciesTraitsData from "@/data/species-traits.json";
import type { SpeciesCatalogue } from "@/lib/idguide/traits";
import { TileGate, MaskSilhouette, type TileSpec } from "@/components/idflow/TileGate";
import silhouetteCredits from "@/data/silhouette-credits.json";

// Which classes have a real PhyloPic asset in public/silhouettes/ (the rest
// fall back to the hand-drawn inline SVG below).
const HAS_SILHOUETTE = new Set(Object.keys(silhouetteCredits));

const CATALOGUE = speciesTraitsData as unknown as SpeciesCatalogue;

// ---------------------------------------------------------------------------
// Fallback silhouettes — one inline SVG per shape class.
// All are single-path stroked art in `currentColor` so they inherit the
// parent's text-teal-500 class. Used only when SILHOUETTES has no PhyloPic
// asset for a class (see the UX-5 note above).
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
  { key: "jellyfish",  label: "Jellyfish",  Icon: SilJellyfish },
  { key: "starfish",   label: "Starfish",   Icon: SilStarfish },
  { key: "gastropod",  label: "Snail / slug", Icon: SilGastropod },
  { key: "squid",      label: "Squid",      Icon: SilSquid },
];

/** ShapeClass → its gate label, for breadcrumbs in later rungs. */
export const SHAPE_CLASS_LABEL = Object.fromEntries(
  TILES.map((t) => [t.key, t.label]),
) as Record<ShapeClass, string>;

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
  const candidateCounts = useMemo(() => {
    const out: Partial<Record<ShapeClass, number>> = {};
    for (const sc of SHAPE_CLASS) {
      // limit: 100 so the tile badge shows the TRUE count — narrowCandidates
      // defaults to 12, which undercounted the 26-species fish tile as "12".
      out[sc] = narrowCandidates({ catalogue: CATALOGUE, shapeClass: sc, limit: 100 }).length;
    }
    return out;
  }, []);

  const tiles: TileSpec[] = TILES.map(({ key, label, Icon }) => {
    const count = candidateCounts[key] ?? 0;
    return {
      key,
      label,
      badge: count,
      disabled: count === 0,
      ariaLabel: `${label}${count > 0 ? `, ${count} species` : ", none in catalogue yet"}`,
      icon: HAS_SILHOUETTE.has(key) ? (
        // UX-5: real PhyloPic silhouette (CC0/PD), tinted via mask + bg-current.
        <MaskSilhouette src={`/silhouettes/${key}.svg`} />
      ) : (
        <Icon />
      ),
    };
  });

  return (
    <TileGate
      ariaLabel="What shape is it?"
      title="What shape is it, roughly?"
      tiles={tiles}
      columns={4}
      onSelect={(key) => onSelectShape(key as ShapeClass)}
      onClose={onClose}
      notSure={{ label: "Not sure", onClick: () => onSelectShape(null) }}
      skip={{ label: "Skip to guess", onClick: onSkip }}
    />
  );
}
