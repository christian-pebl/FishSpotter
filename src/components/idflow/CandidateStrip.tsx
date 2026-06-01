"use client";

/**
 * UX-1 + UX-2: the adaptive narrowing strip.
 *
 * Once the "Spot It" shape gate has set a shapeClass, this owns Rung 3 of the
 * guided flow:
 *   - It renders the live `narrowCandidates()` set for the class as tappable
 *     chips (UX-1), and
 *   - while more than NARROW_ENOUGH candidates remain, it asks the single
 *     most-discriminating visual question via `nextBestTrait` (UX-2). A
 *     yes/no/skip answer narrows the set, the chips shrink, and the next
 *     question is recomputed. Questions auto-stop once the set is small enough
 *     to just eyeball.
 *
 * Tapping a chip commits the common name through the same submit path as the
 * MCQ (onPick), so the unauth signin-carry in useCreatureQuiz is honoured.
 *
 * Thumbnails are deliberately deferred (no cheap batch image source for
 * arbitrary catalogue species; real art is Workstream D / UX-5). Text chips
 * prove the narrowing loop without N image fetches per card mount.
 */

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { narrowCandidates, speciesValuesFor, type Candidate, type TraitKey } from "@/lib/idguide/narrow";
import { nextBestTrait } from "@/lib/idguide/next-trait";
import { traitQuestion } from "@/lib/idflow/trait-questions";
import speciesTraitsData from "@/data/species-traits.json";
import type { ShapeClass, SpeciesCatalogue, TraitSelection } from "@/lib/idguide/traits";

const CATALOGUE = speciesTraitsData as unknown as SpeciesCatalogue;

// UX-3: branch-specific Rung 2 sub-split — a single visual, multi-option first
// cut shown BEFORE the adaptive yes/no questions, but only when it actually
// divides the candidates. Per the UX plan it is "0-1 steps" and "many branches
// have zero sub-splits": flatfish has one species and crab is small enough for
// the adaptive loop, so only fish (the 12-species branch) gets one for now. The
// body-form labels mirror the existing IdGuideWizard for consistency.
type SubSplit = { key: TraitKey; prompt: string; options: { value: string; label: string }[] };
const SUB_SPLITS: Partial<Record<ShapeClass, SubSplit>> = {
  fish: {
    key: "bodyShape",
    prompt: "What was the overall body shape?",
    options: [
      { value: "fusiform", label: "Torpedo / streamlined" },
      { value: "laterally-compressed", label: "Tall and thin" },
      { value: "elongated", label: "Long and slender" },
      { value: "eel-like", label: "Eel-like" },
      { value: "flat-dorsoventral", label: "Flat, on the bottom" },
    ],
  },
};

// Distinct values a trait takes across the candidate set — used to decide
// whether a sub-split (or any option) would actually discriminate.
function candidatesHaveValue(candidates: Candidate[], key: TraitKey, value: string): boolean {
  return candidates.some((c) => {
    const traits = CATALOGUE[c.scientificName];
    return traits ? speciesValuesFor(traits, key).includes(value) : false;
  });
}

// Match the IdGuideWizard's stop point (P-26): 3 is where a learner can
// actually compare the remaining candidates side by side, so we stop asking.
const NARROW_ENOUGH = 3;

// A human label per shape class for the strip header ("3 crabs", "2 fish").
const SHAPE_NOUN: Record<ShapeClass, string> = {
  crab: "crab",
  fish: "fish",
  flatfish: "flatfish",
  scooter: "scooter",
  jellyfish: "jellyfish",
  starfish: "starfish",
  gastropod: "snail",
  squid: "squid",
};

function pluralise(n: number, noun: string): string {
  if (n === 1) return noun;
  if (noun === "fish" || noun === "squid") return noun;
  return `${noun}s`;
}

// Append a value to a TraitSelection key without mutating the source.
function addValue(sel: TraitSelection, key: TraitKey, value: string): TraitSelection {
  const existing = (sel as Record<string, string[] | undefined>)[key] ?? [];
  return { ...sel, [key]: [...existing, value] };
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
  // Rung 3 state: accumulated yes/no trait answers + which traits we've asked.
  const [mustHave, setMustHave] = useState<TraitSelection>({});
  const [mustNotHave, setMustNotHave] = useState<TraitSelection>({});
  const [askedKeys, setAskedKeys] = useState<TraitKey[]>([]);

  // Reset the trait loop whenever the gate changes the shape class.
  useEffect(() => {
    setMustHave({});
    setMustNotHave({});
    setAskedKeys([]);
  }, [shapeClass]);

  const candidates = useMemo(
    // Limit well above the catalogue size: the shrinking count IS the feature,
    // so it must be the true match count, never capped (narrowCandidates
    // defaults to 12, which would silently undercount the fish branch).
    () => narrowCandidates({ catalogue: CATALOGUE, shapeClass, mustHave, mustNotHave, limit: 100 }),
    [shapeClass, mustHave, mustNotHave],
  );

  // The next most-discriminating question, computed over the trait objects of
  // the species still in contention.
  const nextTrait = useMemo(() => {
    if (candidates.length <= NARROW_ENOUGH) return null;
    const traits = candidates.map((c) => CATALOGUE[c.scientificName]).filter(Boolean);
    return nextBestTrait(traits, askedKeys);
  }, [candidates, askedKeys]);

  // UX-3: the Rung 2 sub-split for this shape class, if one is configured and
  // not yet answered. Only the options actually present in the candidate set
  // are offered, and it is shown only when >= 2 of them remain (otherwise it
  // can't discriminate, per the UX plan).
  const subSplit = useMemo(() => {
    const config = SUB_SPLITS[shapeClass];
    if (!config || askedKeys.includes(config.key)) return null;
    if (candidates.length <= NARROW_ENOUGH) return null;
    const options = config.options.filter((o) =>
      candidatesHaveValue(candidates, config.key, o.value),
    );
    return options.length >= 2 ? { key: config.key, prompt: config.prompt, options } : null;
  }, [shapeClass, askedKeys, candidates]);

  const answeredAny = askedKeys.length > 0;

  // Off-class with no seeded species yet (jellyfish/starfish/etc.) — the gate
  // already disables those tiles, but guard anyway so we never show "0".
  if (candidates.length === 0 && !answeredAny) return null;

  const noun = SHAPE_NOUN[shapeClass];

  function answer(verdict: "yes" | "no" | "skip") {
    if (!nextTrait) return;
    const { key, value } = nextTrait;
    if (verdict === "yes") setMustHave((s) => addValue(s, key, value));
    else if (verdict === "no") setMustNotHave((s) => addValue(s, key, value));
    setAskedKeys((k) => [...k, key]);
  }

  // Sub-split answer: pick a body-form (constrain) or skip (just mark asked so
  // the adaptive loop takes over without re-asking the sub-split trait).
  function answerSubSplit(value: string | null) {
    if (!subSplit) return;
    if (value) setMustHave((s) => addValue(s, subSplit.key, value));
    setAskedKeys((k) => [...k, subSplit.key]);
  }

  function startOver() {
    setMustHave({});
    setMustNotHave({});
    setAskedKeys([]);
  }

  return (
    <div className="pb-1.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-300/90">
          {candidates.length === 0
            ? "No matches — try start over"
            : `${candidates.length} ${pluralise(candidates.length, noun)} left`}
        </p>
        <div className="flex shrink-0 items-center gap-3">
          {answeredAny && (
            <button
              type="button"
              onClick={startOver}
              className="inline-flex min-h-[44px] items-center px-2 -mx-2 text-[10px] uppercase tracking-wider text-white/45 hover:text-white/80"
            >
              Start over
            </button>
          )}
          <button
            type="button"
            onClick={onChangeShape}
            className="inline-flex min-h-[44px] items-center px-2 -mx-2 text-[10px] uppercase tracking-wider text-white/45 hover:text-white/80"
          >
            Change shape
          </button>
        </div>
      </div>

      {/* UX-3: Rung 2 sub-split. A single visual multi-option cut, shown before
          the adaptive yes/no questions when it discriminates. */}
      {subSplit && (
        <div className="mb-2 rounded-modal border border-teal-500/25 bg-teal-500/5 px-3 py-2.5">
          <p className="pb-2 text-[12px] font-medium leading-snug text-white/90">
            {subSplit.prompt}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {subSplit.options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => answerSubSplit(o.value)}
                className="flex min-h-[44px] items-center rounded-full border border-teal-400/50 bg-teal-500/10 px-3 text-[12px] font-medium text-teal-50 transition-colors hover:border-teal-400 hover:bg-teal-500/25"
              >
                {o.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => answerSubSplit(null)}
              className="flex min-h-[44px] items-center rounded-full px-3 text-[10px] uppercase tracking-wider text-white/40 transition-colors hover:text-white/75"
            >
              Not sure
            </button>
          </div>
        </div>
      )}

      {/* UX-2: adaptive question. Only after any sub-split, while the set is
          still too big to eyeball and a discriminating trait remains. */}
      {!subSplit && nextTrait && (
        <div className="mb-2 rounded-modal border border-teal-500/25 bg-teal-500/5 px-3 py-2.5">
          <p className="pb-2 text-[12px] font-medium leading-snug text-white/90">
            {traitQuestion(nextTrait.key, nextTrait.value)}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => answer("yes")}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-full border border-teal-400/60 bg-teal-500/15 px-3 text-[12px] font-semibold uppercase tracking-wider text-teal-50 transition-colors hover:bg-teal-500/30"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => answer("no")}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-full border border-white/20 bg-white/5 px-3 text-[12px] font-semibold uppercase tracking-wider text-white/80 transition-colors hover:border-white/40 hover:bg-white/10"
            >
              No
            </button>
            <button
              type="button"
              onClick={() => answer("skip")}
              className="flex min-h-[44px] items-center justify-center rounded-full px-3 text-[10px] uppercase tracking-wider text-white/40 transition-colors hover:text-white/75"
            >
              Not sure
            </button>
          </div>
        </div>
      )}

      {candidates.length > 0 && (
        <>
          {!subSplit && !nextTrait && (
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-white/45">
              Which looks like yours?
            </p>
          )}
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
        </>
      )}
    </div>
  );
}
