"use client";

import { useMemo, useState } from "react";
import speciesTraitsData from "@/data/species-traits.json";
import type { SpeciesCatalogue, TraitSelection } from "@/lib/idguide/traits";
import { narrowCandidates, type Candidate } from "@/lib/idguide/narrow";
import { SpeciesGallery } from "./SpeciesGallery";
import { AnnotatedSpeciesPhoto } from "./AnnotatedSpeciesPhoto";

const CATALOGUE = speciesTraitsData as unknown as SpeciesCatalogue;

type StepKey = "bodyShape" | "size" | "finShape" | "habitat" | "markings" | "behavior";

type StepOption = { value: string; label: string; hint?: string };

type Step = { key: StepKey; question: string; whyHint: string; options: StepOption[] };

// Ordered most-discriminating first. Hints use everyday vocabulary so a
// citizen scientist can answer without knowing fish anatomy.
//
// S9-T1 PR3: each step now carries a `whyHint` explaining the marine
// biologist's rationale for asking that question at that point in the
// funnel. Surfaced behind a disclosure so it does not add visual noise
// for repeat users, but it is what turns the wizard from a guessing aid
// into a teaching tool.
const STEPS: Step[] = [
  {
    key: "bodyShape",
    question: "What was the body shape?",
    whyHint:
      "Body shape locks the fish family in under a second. Torpedo vs flat vs eel-like rules out 80% of species before you look at anything else.",
    options: [
      { value: "fusiform", label: "Torpedo / streamlined", hint: "Cod, mackerel, bass" },
      { value: "elongated", label: "Long and slender", hint: "Pollack, sand smelt" },
      { value: "eel-like", label: "Eel-like", hint: "Conger, butterfish" },
      { value: "flat-dorsoventral", label: "Flat, lying on bottom", hint: "Plaice, dragonet" },
      { value: "laterally-compressed", label: "Tall and thin", hint: "Wrasse, bib" },
    ],
  },
  {
    key: "size",
    question: "Roughly how big was it?",
    whyHint:
      "Size eliminates close-shape lookalikes. A 4 cm fry and a 60 cm adult can share a silhouette but belong to entirely different species.",
    options: [
      { value: "small", label: "Small", hint: "under ~10 cm" },
      { value: "medium", label: "Medium", hint: "~10-50 cm" },
      { value: "large", label: "Large", hint: "over ~50 cm" },
    ],
  },
  {
    // Stage 2 in the original spec ("Fins and tail"). Asks about the
    // single most structural fingerprint a fish has: its dorsal layout
    // and tail shape. Two distinct dorsals is a gadoid signature; one
    // long dorsal points at wrasse / eels / blennies; a deeply forked
    // tail is a cruiser, a rounded tail is a bottom-hugger. We expose
    // the four most discriminating values; `lyre-shaped` and `long-anal`
    // are in the trait vocabulary but too niche for a citizen-science
    // wizard step, so the predicate engine still uses them silently.
    key: "finShape",
    question: "What did the fins or tail look like?",
    whyHint:
      "Fin layout is a structural fingerprint: a fish cannot change it. Two distinct dorsal fins is a gadoid signature; one long continuous dorsal points at wrasse, eels or blennies. Tail shape narrows it further: a deeply forked tail belongs to a fast cruiser, a rounded tail to a bottom-hugger.",
    options: [
      { value: "split-dorsal", label: "Two or three distinct dorsal fins", hint: "Cod, bib, pollack, bass" },
      { value: "single-dorsal", label: "One long continuous dorsal fin", hint: "Wrasse, conger, blenny" },
      { value: "forked-tail", label: "Deeply forked / V-shaped tail", hint: "Cod, mackerel, mullet" },
      { value: "rounded-tail", label: "Rounded / paddle-shaped tail", hint: "Plaice, dragonet, blenny" },
    ],
  },
  {
    key: "habitat",
    question: "Where was it?",
    whyHint:
      "Where a fish lives is often as diagnostic as how it looks. Pelagic vs demersal, kelp vs sand, midwater vs hiding: habitat alone splits many lookalikes.",
    options: [
      { value: "open-water", label: "Open water" },
      { value: "midwater", label: "Hovering in mid-water" },
      { value: "sandy-bottom", label: "On a sandy bottom" },
      { value: "rocky-crevice", label: "In a rocky crevice" },
      { value: "kelp", label: "In kelp or weed" },
      { value: "near-surface", label: "Near the surface" },
    ],
  },
  {
    key: "markings",
    question: "Any noticeable markings?",
    whyHint:
      "A single mark often settles a species when shape alone leaves you with three candidates. A pectoral spot, an eye-spot, a vertical bar: these are what fisheries scientists actually look for.",
    options: [
      { value: "lateral-stripe", label: "Stripe along the side" },
      { value: "dorsal-spots", label: "Spots on body or fins" },
      { value: "eye-spot", label: "An eye-spot (ocellus)" },
      { value: "banded", label: "Vertical bands" },
      { value: "none", label: "None, plain or uniform" },
    ],
  },
  {
    key: "behavior",
    question: "How was it moving?",
    whyHint:
      "Movement is the clincher. Schooling vs solitary, hovering vs cruising, on-bottom vs midwater: behaviour confirms or breaks an ID that body + markings left ambiguous.",
    options: [
      { value: "schooling", label: "In a school or shoal" },
      { value: "hovering", label: "Hovering still" },
      { value: "hiding", label: "Hiding or peeking out" },
      { value: "fast-swim", label: "Cruising fast" },
      { value: "on-bottom", label: "Resting on the bottom" },
    ],
  },
];

const EMPTY_SELECTIONS: Record<StepKey, string | null> = {
  bodyShape: null,
  size: null,
  finShape: null,
  habitat: null,
  markings: null,
  behavior: null,
};

// Reveal once we are past the last step OR narrowed enough that more
// questions would just churn ordering without changing the answer set.
// P-26: raised from 5 to 3. Five candidates still leaves too much
// ambiguity; 3 is the point where a learner can actually compare them.
const NARROW_ENOUGH = 3;

// P-5: first sentence of the rationale is always visible; remainder
// folds behind a disclosure for repeat users.
function WhyHint({ hint }: { hint: string }) {
  const dotIdx = hint.indexOf(". ");
  const firstSentence = dotIdx > -1 ? hint.slice(0, dotIdx + 1) : hint;
  const remainder = dotIdx > -1 ? hint.slice(dotIdx + 2) : null;
  return (
    <div className="pb-3 text-[11px]">
      <p className="leading-relaxed text-white/60">{firstSentence}</p>
      {remainder && (
        <details className="group mt-1">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-teal-400/70 transition hover:text-teal-300 [&::-webkit-details-marker]:hidden">
            <span className="text-[10px]">&#9658;</span>
            <span className="group-open:hidden text-[10px] uppercase tracking-wider">More</span>
            <span className="hidden group-open:inline text-[10px] uppercase tracking-wider">Less</span>
          </summary>
          <p className="pl-3 pt-1.5 leading-relaxed text-white/55">{remainder}</p>
        </details>
      )}
    </div>
  );
}

export function IdGuideWizard({
  probabilityByScientific = {},
  onPick,
  onSwitchToChat,
  onSwitchToChips,
}: {
  probabilityByScientific?: Record<string, number>;
  onPick: (commonName: string) => void;
  /** When the user is logged in we offer the chat as a fallback. */
  onSwitchToChat?: () => void;
  onSwitchToChips: () => void;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const [selections, setSelections] = useState(EMPTY_SELECTIONS);

  const mustHave = useMemo<TraitSelection>(() => {
    const out: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(selections)) {
      if (v) out[k] = [v];
    }
    return out as TraitSelection;
  }, [selections]);

  const candidates = useMemo(
    () =>
      narrowCandidates({
        catalogue: CATALOGUE,
        mustHave,
        probabilityByScientific,
        limit: 12,
      }),
    [mustHave, probabilityByScientific],
  );

  const hasAnsweredAny = Object.values(selections).some((v) => v != null);
  const showFinal =
    stepIdx >= STEPS.length || (hasAnsweredAny && candidates.length <= NARROW_ENOUGH);

  function answerCurrent(value: string | null) {
    const key = STEPS[stepIdx].key;
    setSelections((prev) => ({ ...prev, [key]: value }));
    setStepIdx((i) => i + 1);
  }

  function back() {
    if (stepIdx === 0) return;
    setStepIdx((i) => i - 1);
  }

  function restart() {
    setStepIdx(0);
    setSelections(EMPTY_SELECTIONS);
  }

  if (showFinal) {
    return (
      <FinalReveal
        candidates={candidates}
        onPick={onPick}
        onRestart={restart}
        onSwitchToChat={onSwitchToChat}
        onSwitchToChips={onSwitchToChips}
      />
    );
  }

  const step = STEPS[stepIdx];
  // P-25: only show the step counter once 3 or fewer steps remain.
  const showStepCounter = STEPS.length - stepIdx <= 3;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 [scrollbar-gutter:stable]">
        <div className="flex items-center justify-between pb-1 text-[10px] uppercase tracking-wider">
          <span className="text-white/55">
            {showStepCounter ? `Step ${stepIdx + 1} of ${STEPS.length}` : ""}
          </span>
          <span className="text-white/35">
            {candidates.length} match{candidates.length === 1 ? "" : "es"} so far
          </span>
        </div>
        <h3 className="pb-1 text-base font-semibold text-white/90">{step.question}</h3>
        <WhyHint hint={step.whyHint} />
        <div className="space-y-2">
          {step.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => answerCurrent(opt.value)}
              className="block w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-left transition-colors hover:border-teal-500/60 hover:bg-white/10"
            >
              <span className="block text-sm text-white/90">{opt.label}</span>
              {opt.hint && (
                <span className="block pt-0.5 text-[11px] text-white/50">{opt.hint}</span>
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={() => answerCurrent(null)}
            className="block w-full rounded-xl border border-white/10 bg-transparent px-3 py-2.5 text-left text-sm text-white/55 transition-colors hover:border-white/25 hover:text-white/85"
          >
            Not sure, skip this question
          </button>
        </div>
      </div>
      <Footer
        back={stepIdx > 0 ? back : null}
        onSwitchToChat={onSwitchToChat}
        onSwitchToChips={onSwitchToChips}
      />
    </div>
  );
}

function FinalReveal({
  candidates,
  onPick,
  onRestart,
  onSwitchToChat,
  onSwitchToChips,
}: {
  candidates: Candidate[];
  onPick: (commonName: string) => void;
  onRestart: () => void;
  onSwitchToChat?: () => void;
  onSwitchToChips: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 [scrollbar-gutter:stable]">
        {candidates.length === 0 ? (
          <div>
            <p className="text-sm text-white/80">
              No species in our local catalogue match all of those traits.
            </p>
            <p className="pt-2 text-[12px] text-white/55">
              Try starting over and skipping a step you&apos;re unsure about, or
              switch to the manual trait filter for a less strict match.
            </p>
          </div>
        ) : (
          <>
            <p className="pb-1 text-[10px] uppercase tracking-wider text-white/55">
              {candidates.length === 1
                ? "1 likely match"
                : `${candidates.length} likely matches`}
            </p>
            <p className="pb-3 text-[11px] text-white/45">
              Pick the one that fits, or read the field note first.
            </p>
            {/* P-3: top candidate is fully expanded. Others collapse to
                name + scientific name only, expandable on demand.
                The top result is the teaching moment. */}
            <div className="space-y-2">
              {candidates.map((c, candidateIdx) => {
                const traits = CATALOGUE[c.scientificName];
                const isTop = candidateIdx === 0;
                return (
                  <details
                    key={c.scientificName}
                    open={isTop}
                    className="rounded-xl border border-white/12 bg-white/5"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                      <div className="min-w-0">
                        <span className="block text-sm font-semibold text-white/95">{c.commonName}</span>
                        <span className="block text-[10px] italic text-white/45">{c.scientificName}</span>
                      </div>
                      <span className="shrink-0 text-[10px] uppercase tracking-wider text-teal-400/70">
                        {isTop ? "Top match" : "Details"}
                      </span>
                    </summary>
                    <div className="px-3 pb-3">
                      {/* S9-T1 PR3: diagnostic-mark photo renders null when
                          no admin-authored marks exist for this species, so
                          the plain thumb strip below acts as fallback. */}
                      <div className="pb-2">
                        <AnnotatedSpeciesPhoto
                          scientificName={c.scientificName}
                          commonName={c.commonName}
                        />
                      </div>
                      <div className="pb-2">
                        <SpeciesGallery
                          scientificName={c.scientificName}
                          commonName={c.commonName}
                          size="thumb"
                        />
                      </div>
                      {traits?.fieldNote && (
                        <p className="pb-3 text-[12px] leading-relaxed text-white/75">
                          {traits.fieldNote}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => onPick(c.commonName)}
                        className="rounded-full bg-teal-500 px-3 py-1.5 text-[11px] font-semibold text-navy-900 hover:bg-teal-400"
                      >
                        Use &quot;{c.commonName}&quot; as my answer
                      </button>
                    </div>
                  </details>
                );
              })}
            </div>
          </>
        )}
      </div>
      <Footer
        back={onRestart}
        backLabel="Start over"
        onSwitchToChat={onSwitchToChat}
        onSwitchToChips={onSwitchToChips}
      />
    </div>
  );
}

function Footer({
  back,
  backLabel = "Back",
  onSwitchToChat,
  onSwitchToChips,
}: {
  back: (() => void) | null;
  backLabel?: string;
  onSwitchToChat?: () => void;
  onSwitchToChips: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/10 px-4 py-3 text-[10px] uppercase tracking-wider">
      {back ? (
        <button
          type="button"
          onClick={back}
          className="text-white/55 transition-colors hover:text-white/90"
        >
          {backLabel}
        </button>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-3">
        {onSwitchToChat && (
          <button
            type="button"
            onClick={onSwitchToChat}
            className="text-teal-500 transition-colors hover:text-teal-400"
          >
            Ask the biologist
          </button>
        )}
        <button
          type="button"
          onClick={onSwitchToChips}
          className="text-white/35 transition-colors hover:text-white/70"
        >
          All traits
        </button>
      </div>
    </div>
  );
}
