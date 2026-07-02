/**
 * Rung 2 (body-shape sub-split) data + helpers, shared between the
 * BodyShapeGate (the draggable Rung-2 card) and CandidateStrip (Rung 3, which
 * must suppress the inline sub-split once the gate has owned it).
 *
 * The SUB_SPLITS table was lifted out of CandidateStrip so there is one source
 * of truth for the per-shape-class first cut. The labels mirror the existing
 * IdGuideWizard phrasing for consistency.
 */

import {
  narrowCandidates,
  speciesValuesFor,
  type Candidate,
  type TraitKey,
} from "@/lib/idguide/narrow";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import type { ShapeClass } from "@/lib/idguide/traits";


export type SubSplit = {
  key: TraitKey;
  prompt: string;
  options: { value: string; label: string }[];
};

// Branch-specific first cut. flatfish has one species so it gets no sub-split
// (and so no Rung-2 gate); fish splits on `fishGroup`, a plain-English family
// gestalt (cod-shaped / wrasse / silver swimmer / bottom-sitter / long-skinny /
// shark) that a beginner can read off a clip, replacing the old `bodyShape` cut
// whose merged "Torpedo or deep-bodied" bucket held 20 species. Each invert
// class splits on its own "form" trait.
export const SUB_SPLITS: Partial<Record<ShapeClass, SubSplit>> = {
  crab: {
    key: "crabForm",
    prompt: "What was the body shape?",
    options: [
      { value: "broad-carapace", label: "Broad oval crab" },
      { value: "swimming", label: "Paddle back legs (swimmer)" },
      { value: "spider", label: "Triangular, long legs (spider)" },
      { value: "hermit", label: "In a shell (hermit)" },
    ],
  },
  fish: {
    // Family-gestalt cut (17 Jun 2026), replacing the old body-shape split whose
    // merged "Torpedo or deep-bodied" bucket held 20 species. Each option keeps
    // its Rung-3 grid <=10 with no further rung. Grounded in UK field guides +
    // a 28-photo vision pass (implementation/2026-06-17/).
    key: "fishGroup",
    prompt: "What kind of fish was it?",
    options: [
      { value: "cod-like", label: "Cod-shaped" },
      { value: "wrasse", label: "Wrasses" },
      // Label is appearance-based, NOT behaviour-based: bass (and adult mullet)
      // are not reliable shoalers, so "shoalers" mis-cued field testers. The
      // value stays `silver-shoaler` (the trait/silhouette are unchanged); only
      // the user-facing tile label reads "Silver swimmers".
      { value: "silver-shoaler", label: "Silver swimmers" },
      // bottom-sitter was split on 18 Jun 2026 (it had hit the 10-species
      // ceiling). The split now cuts on SIZE, which a beginner can judge off a
      // clip far more reliably than "is this a goby or a gurnard?": the small
      // smooth perch-and-darters (gobies + dragonets, all ~4-8 cm) stay here as
      // "Small bottom fish"; the chunkier seabed fish (gurnards, red mullet, and
      // the bigger sea scorpion + shanny, all medium-plus) are "Bigger bottom
      // fish". Sea scorpion + shanny were re-tagged small -> medium so the size
      // cut is clean (they're 12-17 cm, genuinely bigger than a goby).
      { value: "bottom-sitter", label: "Small bottom fish" },
      { value: "bottom-other", label: "Bigger bottom fish" },
      { value: "long-skinny", label: "Long and skinny" },
      { value: "shark", label: "Shark-shaped" },
    ],
  },
  squid: {
    key: "cephalopodForm",
    prompt: "What was the overall body plan?",
    options: [
      { value: "cuttlefish", label: "Broad body, fin all round" },
      { value: "squid", label: "Torpedo, fins at the tail" },
      { value: "bobtail", label: "Tiny, ear-like fins" },
      { value: "octopus", label: "Eight arms, no fins" },
    ],
  },
  starfish: {
    key: "armForm",
    // Was "What were the arms like?" — broadened 2 Jul 2026 when sea urchins
    // (no arms at all) joined this tile rather than getting their own class.
    prompt: "What did the body look like?",
    options: [
      { value: "short-stubby", label: "Five short fat arms" },
      { value: "long-spiny", label: "Long arms, rows of spines" },
      { value: "long-smooth", label: "Long arms, no spines" },
      { value: "thin-whippy", label: "Thread-thin whippy arms" },
      { value: "round-spiny", label: "Round spiny ball, no arms" },
      { value: "heart-shaped", label: "Oval/heart-shaped, fine spines" },
    ],
  },
  gastropod: {
    key: "shellShape",
    prompt: "What was the shell like?",
    options: [
      { value: "flat-cone", label: "Low cone on the rock" },
      { value: "pointed-cone", label: "Tall pointed spire" },
      { value: "rounded-squat", label: "Squat rounded whorl" },
      { value: "no-shell", label: "No shell (slug-like)" },
    ],
  },
  jellyfish: {
    key: "bellForm",
    prompt: "What was the bell like?",
    options: [
      { value: "saucer", label: "Saucer, short tentacles" },
      { value: "frilly-arms", label: "Solid bell, frilly arms" },
      { value: "trailing-mass", label: "Long trailing tentacles" },
    ],
  },
  // NB: no `wildlife` entry yet. The `wildlifeForm` trait + its two values
  // (diving-bird, pinniped) are already live in traits.ts/narrow.ts/
  // catalogue.ts, and this SUB_SPLITS entry is drafted and ready in
  // implementation/2026-07-02/new-species-onboarding.md — but body-forms.test.ts
  // requires every SUB_SPLITS key to resolve to >=2 real catalogue species
  // right now (bodyFormConfigFor filters zero-count options to null), so
  // wiring it in before the wildlife species land would break CI. Add it back
  // the moment the diving-bird + seal species are merged into
  // species-traits.json (see the same doc for the exact snippet to paste in).
};

export type BodyFormOption = { value: string; label: string; count: number };
export type BodyFormConfig = {
  key: TraitKey;
  prompt: string;
  options: BodyFormOption[];
};

function classCandidates(shapeClass: ShapeClass): Candidate[] {
  return narrowCandidates({ catalogue: CATALOGUE, shapeClass, limit: 100 });
}

function countForValue(
  candidates: Candidate[],
  key: TraitKey,
  value: string,
): number {
  return candidates.filter((c) => {
    const t = CATALOGUE[c.scientificName];
    return t ? speciesValuesFor(t, key).includes(value) : false;
  }).length;
}

/**
 * The discriminating Rung-2 options for a shape class, each with its species
 * count. Returns null when the class has no sub-split or fewer than two options
 * are actually present in the catalogue (so a single-choice cut never shows). The
 * caller (FeedCard) uses null to skip the Rung-2 gate and go straight to Rung 3.
 */
export function bodyFormConfigFor(shapeClass: ShapeClass): BodyFormConfig | null {
  const config = SUB_SPLITS[shapeClass];
  if (!config) return null;
  const cands = classCandidates(shapeClass);
  const options: BodyFormOption[] = config.options
    .map((o) => ({ ...o, count: countForValue(cands, config.key, o.value) }))
    .filter((o) => o.count > 0);
  return options.length >= 2
    ? { key: config.key, prompt: config.prompt, options }
    : null;
}

export type ExampleSpecies = { scientificName: string; commonName: string };

/** Catalogue species in this class that have the given body form — the
 * "Examples" set. Capped; ordering follows narrowCandidates' weighting. */
export function exampleSpeciesForForm(
  shapeClass: ShapeClass,
  key: TraitKey,
  value: string,
  limit = 6,
): ExampleSpecies[] {
  const out: ExampleSpecies[] = [];
  for (const c of classCandidates(shapeClass)) {
    const t = CATALOGUE[c.scientificName];
    if (t && speciesValuesFor(t, key).includes(value)) {
      out.push({ scientificName: c.scientificName, commonName: c.commonName });
      if (out.length >= limit) break;
    }
  }
  return out;
}
