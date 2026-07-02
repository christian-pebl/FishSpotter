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
import { motion, useReducedMotion } from "framer-motion";
import { narrowCandidates, speciesValuesFor, type Candidate, type TraitKey } from "@/lib/idguide/narrow";
import { nextBestTrait } from "@/lib/idguide/next-trait";
import { traitQuestion } from "@/lib/idflow/trait-questions";
import { SUB_SPLITS } from "@/lib/idflow/body-forms";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import type { ShapeClass, TraitSelection } from "@/lib/idguide/traits";
import { TRANSITION } from "@/lib/motion";
import bodyformCredits from "@/data/bodyform-silhouette-credits.json";

// Keys present in the credits file = a real PhyloPic SVG exists in
// public/silhouettes/forms/<value>.svg for this form option.
const HAS_FORM_SILHOUETTE = new Set(Object.keys(bodyformCredits));


// UX-3: branch-specific Rung 2 sub-split now lives in @/lib/idflow/body-forms
// (SUB_SPLITS), shared with the Rung-2 BodyShapeGate. When the gate has owned
// Rung 2 it passes a `seed` (below), which pre-marks the sub-split key as asked,
// so the inline sub-split here is suppressed and only the gate-less paths
// (e.g. crab, or "Not sure") fall back to rendering it inline.

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
  jellyfish: "jellyfish",
  starfish: "starfish",
  wildlife: "animal",
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
  onSkipToMCQ,
  seed,
}: {
  /** null = the user tapped "Not sure" at the gate: narrow the whole catalogue
   *  (the weighted best-guess set) instead of dead-ending — the murky-safe path. */
  shapeClass: ShapeClass | null;
  submitting: boolean;
  /** Commit a guess by common name (same path as the MCQ picker). */
  onPick: (commonName: string) => void;
  /** Reopen the shape gate so the user can pick a different class. */
  onChangeShape: () => void;
  /** Bail out to the MCQ when narrowing reaches zero candidates after answering. */
  onSkipToMCQ?: () => void;
  /** Rung-2 result handed down from the BodyShapeGate: the sub-split trait key
   *  and the chosen form value (null = the user skipped the form). Seeds the
   *  narrowing and marks the key asked so the inline sub-split is not re-shown. */
  seed?: { key: TraitKey; value: string | null };
}) {
  const reduceMotion = useReducedMotion();
  // Rung 3 state: accumulated yes/no trait answers + which traits we've asked.
  const [mustHave, setMustHave] = useState<TraitSelection>({});
  const [mustNotHave, setMustNotHave] = useState<TraitSelection>({});
  const [askedKeys, setAskedKeys] = useState<TraitKey[]>([]);

  // Reset (and seed) the trait loop whenever the shape class — or the Rung-2
  // seed — changes. seedSig is a primitive so this doesn't re-run (and wipe the
  // user's in-progress answers) on every render from the object identity churn.
  const seedSig = seed ? `${seed.key}:${seed.value ?? ""}` : "";
  useEffect(() => {
    if (seed) {
      setMustHave(seed.value ? ({ [seed.key]: [seed.value] } as TraitSelection) : {});
      setMustNotHave({});
      setAskedKeys([seed.key]);
    } else {
      setMustHave({});
      setMustNotHave({});
      setAskedKeys([]);
    }
    // seedSig captures `seed`; depending on the object itself would thrash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapeClass, seedSig]);

  const candidates = useMemo(
    // Limit well above the catalogue size: the shrinking count IS the feature,
    // so it must be the true match count, never capped (narrowCandidates
    // defaults to 12, which would silently undercount the fish branch).
    () =>
      narrowCandidates({
        catalogue: CATALOGUE,
        shapeClass: shapeClass ?? undefined,
        mustHave,
        mustNotHave,
        limit: 100,
      }),
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
    const config = shapeClass ? SUB_SPLITS[shapeClass] : undefined;
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

  // "species" is invariant (no plural-s) and is the label for the unfiltered
  // "Not sure" path where there is no single shape class.
  const countLabel = shapeClass
    ? pluralise(candidates.length, SHAPE_NOUN[shapeClass])
    : "species";

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
            : `${candidates.length} ${countLabel} left`}
        </p>
        <div className="flex shrink-0 items-center gap-3">
          {answeredAny && candidates.length === 0 && onSkipToMCQ && (
            <button
              type="button"
              onClick={onSkipToMCQ}
              className="inline-flex min-h-[44px] items-center px-2 -mx-2 text-[10px] uppercase tracking-wider text-teal-400/80 hover:text-teal-300"
            >
              Switch to ID guide
            </button>
          )}
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

      {/* P2: scoring reassurance. The scored-by-rung model awards a point for
          the right shape class even when the species guess is wrong, so a
          tentative pick is never wasted. Surfaced subtly to lower commit
          anxiety. */}
      {candidates.length > 0 && (
        <p className="mb-1.5 text-[10px] leading-snug text-white/60">
          Not certain? A pick that&apos;s the right shape class still earns a point.
        </p>
      )}

      {/* UX-3: Rung 2 sub-split. A single visual multi-option cut shown before
          the adaptive yes/no questions when it discriminates. Options render as
          silhouette tiles (same mask-image tint technique as ShapeGate) when a
          PhyloPic SVG exists in public/silhouettes/forms/, otherwise fall back
          to the labelled pill so un-fetched forms degrade gracefully. */}
      {subSplit && (
        <div className="mb-2 rounded-modal border border-teal-500/25 bg-teal-500/5 px-3 py-2.5">
          <p className="pb-2 text-[12px] font-medium leading-snug text-white/90">
            {subSplit.prompt}
          </p>
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${Math.min(subSplit.options.length, 4)}, minmax(0, 1fr))` }}
          >
            {subSplit.options.map((o) =>
              HAS_FORM_SILHOUETTE.has(o.value) ? (
                /* Silhouette tile — mirrors ShapeGate's tile pattern */
                <button
                  key={o.value}
                  type="button"
                  onClick={() => answerSubSplit(o.value)}
                  className="relative flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-modal border border-white/15 bg-white/5 p-2 text-teal-500 transition-colors hover:border-teal-400 hover:bg-teal-500/20 hover:text-teal-300"
                >
                  <span className="flex h-8 w-8 items-center justify-center">
                    <span
                      aria-hidden="true"
                      className="block h-full w-full bg-current"
                      style={{
                        maskImage: `url(/silhouettes/forms/${o.value}.svg)`,
                        WebkitMaskImage: `url(/silhouettes/forms/${o.value}.svg)`,
                        maskRepeat: "no-repeat",
                        WebkitMaskRepeat: "no-repeat",
                        maskPosition: "center",
                        WebkitMaskPosition: "center",
                        maskSize: "contain",
                        WebkitMaskSize: "contain",
                      }}
                    />
                  </span>
                  <span className="text-center text-[10px] font-semibold uppercase leading-tight tracking-wider text-white/70">
                    {o.label}
                  </span>
                </button>
              ) : (
                /* Text pill fallback for any form without a fetched asset */
                <button
                  key={o.value}
                  type="button"
                  onClick={() => answerSubSplit(o.value)}
                  className="flex min-h-[44px] items-center justify-center rounded-modal border border-teal-400/50 bg-teal-500/10 px-3 text-[12px] font-medium text-teal-50 transition-colors hover:border-teal-400 hover:bg-teal-500/25"
                >
                  {o.label}
                </button>
              )
            )}
          </div>
          <button
            type="button"
            onClick={() => answerSubSplit(null)}
            className="mt-2 inline-flex min-h-[44px] items-center px-1 -mx-1 text-[10px] uppercase tracking-wider text-white/40 transition-colors hover:text-white/75"
          >
            Not sure
          </button>
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
          <div className="relative -mx-1">
          <div
            className="flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            role="list"
            aria-label={`${candidates.length} candidate species`}
          >
            {/* The shrinking strip is the plan's "dopamine engine". An earlier
                attempt used a framer AnimatePresence EXIT, which left removed
                chips stuck in this horizontal overflow-x-auto flex (3 in render
                state, 6 mounted). The safe path is layout-only: dropped chips
                simply unmount (React removes them, no exit), and the survivors
                carry `layout` so they slide left to close the gap — most of the
                "tightening" payoff, zero stuck-node risk. Guarded by
                reduceMotion. */}
            {candidates.map((c) => (
              <motion.button
                key={c.scientificName}
                type="button"
                role="listitem"
                layout={!reduceMotion}
                transition={reduceMotion ? undefined : { layout: TRANSITION.layout }}
                disabled={submitting}
                whileTap={!submitting && !reduceMotion ? { scale: 0.96 } : undefined}
                onClick={() => onPick(c.commonName)}
                aria-label={`Pick ${c.commonName}`}
                className="flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-full border border-white/15 bg-white/5 px-3.5 text-[12px] font-medium text-white transition-colors hover:border-teal-400 hover:bg-teal-500/20 hover:text-teal-50 disabled:opacity-60"
              >
                {c.commonName}
              </motion.button>
            ))}
          </div>
          {/* P2: scroll scent. The row hides its scrollbar and can hold up to
              ~26 chips, so a right-edge fade hints there's more off-screen.
              Only when the set is big enough to plausibly overflow. */}
          {candidates.length > 6 && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-navy-900/80 to-transparent"
            />
          )}
          </div>
        </>
      )}
    </div>
  );
}
