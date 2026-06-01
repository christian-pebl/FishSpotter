"use client";

/**
 * UX-1: The shrinking candidate strip.
 *
 * Once the "Spot It" shape gate has set a shapeClass, this strip renders the
 * live `narrowCandidates()` output for that class as a horizontal row of
 * tappable chips. It is the engagement engine of the guided flow: the set
 * shrinks as the user narrows (shape now; adaptive traits in UX-2), and
 * tapping a chip commits that common name through the same submit path the
 * MCQ uses (so the unauth signin-carry in useCreatureQuiz is honoured).
 *
 * Thumbnails are deliberately deferred: arbitrary catalogue species have no
 * cheap batch image source today, and real art is a Workstream D / UX-5
 * concern. Text chips prove the narrowing loop without N image fetches per
 * card mount.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { narrowCandidates } from "@/lib/idguide/narrow";
import speciesTraitsData from "@/data/species-traits.json";
import type { ShapeClass, SpeciesCatalogue } from "@/lib/idguide/traits";

const CATALOGUE = speciesTraitsData as unknown as SpeciesCatalogue;

// A human label per shape class for the strip header ("3 crabs", "2 fish").
const SHAPE_NOUN: Record<ShapeClass, string> = {
  crab: "crab",
  fish: "fish",
  flatfish: "flatfish",
  scooter: "scooter",
  jellyfish: "jellyfish",
  starfish: "starfish",
  gastropod: "gastropod",
  squid: "squid",
};

function pluralise(n: number, noun: string): string {
  if (n === 1) return noun;
  // "fish" and "squid" don't take -s here; the rest do.
  if (noun === "fish" || noun === "squid") return noun;
  return `${noun}s`;
}

export function CandidateStrip({
  shapeClass,
  submitting,
  onPick,
  onChangeShape,
}: {
  shapeClass: ShapeClass;
  submitting: boolean;
  /** Commit a guess by common name (same path as the MCQ picker). */
  onPick: (commonName: string) => void;
  /** Reopen the shape gate so the user can pick a different class. */
  onChangeShape: () => void;
}) {
  const candidates = useMemo(
    () => narrowCandidates({ catalogue: CATALOGUE, shapeClass, limit: 24 }),
    [shapeClass],
  );

  // Off-class with no seeded species yet (jellyfish/starfish/etc.) — the gate
  // already disables those tiles, but guard anyway so we never show "0".
  if (candidates.length === 0) return null;

  const noun = SHAPE_NOUN[shapeClass];

  return (
    <div className="pb-1.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-300/90">
          {candidates.length} {pluralise(candidates.length, noun)} — which looks like yours?
        </p>
        <button
          type="button"
          onClick={onChangeShape}
          className="shrink-0 text-[10px] uppercase tracking-wider text-white/45 hover:text-white/80"
        >
          Change shape
        </button>
      </div>

      <div
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        role="list"
        aria-label={`${candidates.length} candidate species`}
      >
        {candidates.map((c) => (
          <motion.button
            key={c.scientificName}
            type="button"
            role="listitem"
            disabled={submitting}
            whileTap={!submitting ? { scale: 0.96 } : undefined}
            onClick={() => onPick(c.commonName)}
            aria-label={`Pick ${c.commonName}`}
            className="flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-full border border-white/15 bg-white/5 px-3.5 text-[12px] font-medium text-white transition-colors hover:border-teal-400 hover:bg-teal-500/20 hover:text-teal-50 disabled:opacity-60"
          >
            {c.commonName}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
