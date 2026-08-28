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
  options: {
    /** The tile's identity: its seed value, its silhouette filename, and what
     * the breadcrumb/coarse-commit look up. Must be one of `values`. */
    value: string;
    label: string;
    /** Trait values this ONE tile covers, when a tile deliberately bundles more
     * than one form (e.g. the crab gate shows broad-carapace + swimming as a
     * single "Broad oval crabs" tile). Defaults to [value]. The underlying trait
     * values stay intact on the species; this is a presentation grouping only,
     * so a re-grouping never needs a data migration. */
    values?: string[];
  }[];
};

// Branch-specific first cut. flatfish has one species so it gets no sub-split
// (and so no Rung-2 gate); fish splits on `fishZone` (seabed vs water column),
// the one cut a beginner can read straight off a clip without naming a family.
// Each invert class splits on its own "form" trait.
export const SUB_SPLITS: Partial<Record<ShapeClass, SubSplit>> = {
  crab: {
    key: "crabForm",
    prompt: "What was the body shape?",
    options: [
      // Merged 28 Aug 2026. "Broad oval crab" and "Paddle back legs (swimmer)"
      // were two tiles of two species each, and the cut between them asked the
      // user to spot a flattened rear leg on a moving crab in a short clip,
      // which is a detail, not a gestalt. All four are broad oval crabs to a
      // beginner, so they now share one tile and the paddle becomes a Rung-3
      // detail (it survives as `crabFeatures: swimming-paddle` and as the
      // `swimming` crabForm value, both untouched).
      {
        value: "broad-carapace",
        values: ["broad-carapace", "swimming"],
        label: "Broad oval crabs",
      },
      { value: "spider", label: "Triangular, long legs (spider)" },
      { value: "hermit", label: "In a shell (hermit)" },
    ],
  },
  fish: {
    // Zone cut (28 Aug 2026), replacing the seven-way family-gestalt split
    // (cod-shaped / wrasses / silver swimmers / small bottom fish / bigger
    // bottom fish / long and skinny / shark-shaped). Two reasons it went:
    // seven tiles is a lot of reading before the first photo, and every one of
    // them asked a beginner to name a FAMILY off a short clip. This asks the
    // one thing the clip actually shows: was it working the seabed, or up off
    // it? So the gate is a single glance and the real identification happens
    // in the Rung-3 photo grid, which is where users are strongest.
    //
    // The trade: each bucket is now 16-17 species rather than <=10, so the
    // beginner-legibility ceiling from 17 Jun no longer applies to fish. That
    // ceiling was about how many OPTIONS a decision node may offer (still 2
    // here); the Rung-3 grid is a scan of photos, capped at 24 tiles, not a
    // decision between named things. See body-forms.test.ts.
    //
    // The old family groups live on as `fishGroup` (silhouettes, comparison
    // sets, the food web). This is a presentation cut over them, not a
    // replacement for them.
    key: "fishZone",
    prompt: "Where was the fish?",
    options: [
      // Includes the catshark (a small shark that lies on the sand) and the two
      // long-skinny fish that thread along the bottom, the conger and the
      // butterfish.
      { value: "seabed", label: "Moving along the seabed" },
      // Includes the fifteen-spined stickleback (the one long-skinny fish that
      // hangs in the weed above the bottom rather than in it) and the
      // two-spotted goby, the one goby that hovers in mid-water over the kelp
      // instead of perching on the seabed like the rest of its group.
      { value: "water-column", label: "Moving above the seabed" },
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
    prompt: "What were the arms like?",
    options: [
      { value: "short-stubby", label: "Five short fat arms" },
      { value: "long-spiny", label: "Long arms, rows of spines" },
      { value: "long-smooth", label: "Long arms, no spines" },
      { value: "thin-whippy", label: "Thread-thin whippy arms" },
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
  urchin: {
    key: "urchinForm",
    prompt: "What was the shape?",
    options: [
      { value: "round-spiny", label: "Round, spines all over" },
      { value: "heart-shaped", label: "Heart-shaped, in the sand" },
    ],
  },
  other: {
    key: "wildlifeForm",
    prompt: "What was it?",
    options: [
      { value: "bird", label: "A bird" },
      { value: "seal", label: "A mammal" },
    ],
  },
};

export type BodyFormOption = {
  value: string;
  label: string;
  /** Every trait value this tile covers (>1 when the tile bundles forms). */
  values: string[];
  count: number;
};
export type BodyFormConfig = {
  key: TraitKey;
  prompt: string;
  options: BodyFormOption[];
};

function classCandidates(shapeClass: ShapeClass): Candidate[] {
  return narrowCandidates({ catalogue: CATALOGUE, shapeClass, limit: 100 });
}

function matchesAny(
  scientificName: string,
  key: TraitKey,
  values: readonly string[],
): boolean {
  const t = CATALOGUE[scientificName];
  if (!t) return false;
  const own = speciesValuesFor(t, key);
  return values.some((v) => own.includes(v));
}

// Counts SPECIES, not (species x value) pairs, so a species carrying two of a
// bundled tile's values is still one tile at Rung 3.
function countForValues(
  candidates: Candidate[],
  key: TraitKey,
  values: readonly string[],
): number {
  return candidates.filter((c) => matchesAny(c.scientificName, key, values)).length;
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
    .map((o) => {
      const values = o.values ?? [o.value];
      return {
        value: o.value,
        label: o.label,
        values,
        count: countForValues(cands, config.key, values),
      };
    })
    .filter((o) => o.count > 0);
  return options.length >= 2
    ? { key: config.key, prompt: config.prompt, options }
    : null;
}

export type ExampleSpecies = { scientificName: string; commonName: string };

/** Catalogue species in this class that have the given body form, the
 * "Examples" set. Capped; ordering follows narrowCandidates' weighting. */
export function exampleSpeciesForForm(
  shapeClass: ShapeClass,
  key: TraitKey,
  /** One trait value, or every value a bundled tile covers. */
  value: string | readonly string[],
  limit = 6,
): ExampleSpecies[] {
  const values = typeof value === "string" ? [value] : value;
  const out: ExampleSpecies[] = [];
  for (const c of classCandidates(shapeClass)) {
    if (matchesAny(c.scientificName, key, values)) {
      out.push({ scientificName: c.scientificName, commonName: c.commonName });
      if (out.length >= limit) break;
    }
  }
  return out;
}
