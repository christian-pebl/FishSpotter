export const BODY_SHAPE = [
  "elongated",
  // `fusiform` is the merged "normal fish silhouette" bucket: torpedoes AND
  // deep-bodied fish. The old `laterally-compressed` ("Tall and thin") value
  // was retired on 10 Jun 2026 — field testers found the torpedo-vs-tall cut
  // too fine-scale (millimetres) for a Rung-2 gate, so both now sit in one
  // tile and the `bodyDepth` Rung-3 splitter (deep/medium/slender) separates
  // them when it actually matters.
  "fusiform",
  "flat-dorsoventral",
  "eel-like",
  "bottom-scooter",
] as const;
// NB `snake-like` was retired on 3 Jun 2026: it was a duplicate silhouette of
// `eel-like` (no species used it) and would have shown two near-identical Rung-2
// tiles. `eel-like` is the canonical long-continuous-fin silhouette.
// `bottom-scooter` (added 4 Jun 2026) is the fish "Bottom scooters" Rung-2
// bucket: bottom-resting fish that perch then dart in fits and starts —
// dragonets and the round-bodied gobies. It is an ecology/posture grouping, not
// a strict cross-section, so it (deliberately) overlaps with the gobies'
// `elongated`/`fusiform` tags. Distinct from `flat-dorsoventral`, which stays
// the asymmetric eyes-migrated flatfish (plaice/dab/flounder).
export type BodyShape = (typeof BODY_SHAPE)[number];

// Fish Rung-2 grouping (added 17 Jun 2026). This is the FIRST cut a beginner
// makes after tapping "Fish", and it replaces the old `bodyShape` sub-split
// whose merged `fusiform` ("Torpedo or deep-bodied") bucket held 20 of the 28
// fish — far past the ~10-option ceiling and, per a 28-photo vision pass, an
// unreliable cut (deep-vs-torpedo only holds at the extremes). The six values
// are plain-English family gestalts a novice can read off a short underwater
// clip, grounded in three UK field guides (ZSL estuarine key, Sussex IFCA,
// EA/Maitland key) — see implementation/2026-06-17/. Each value keeps its
// bucket <=10 with no further rung needed (largest: bottom-sitter = 9).
// `fishGroup` is the authoritative fish gate trait; `bodyShape` stays as a
// secondary scored descriptor. Optional array on SpeciesTraits, present only on
// fish entries (mirrors bodyDepth/lateralLine).
export const FISH_GROUP = [
  "cod-like", // chunky reef hangers with three separate dorsal fins (gadoids)
  "wrasse", // deep oval, thick-lipped, one long dorsal, fussing in the rocks
  "silver-shoaler", // slim bright-silver open-water fish (mackerel, bass, grey mullet, sprat)
  "bottom-sitter", // small smooth seabed perch-and-darters: gobies + dragonets
  // The other seabed fish, split off bottom-sitter on 18 Jun 2026 when that
  // bucket hit the 10-species Rung-2 ceiling: gurnards, red mullet, sea
  // scorpion, blenny. This is the home for every gurnard (grey/red/tub/streaked)
  // — chunkier or odder bottom fish that walk, root or lurk rather than dart.
  "bottom-other",
  "long-skinny", // eel-like / ribbon body, much longer than deep (conger, butterfish, stickleback)
  "shark", // unmistakable little-shark silhouette (lesser-spotted catshark)
] as const;
export type FishGroup = (typeof FISH_GROUP)[number];

// Singular noun for each fish group, used by the Rung-3 coarse "It's just a ___"
// commit so it reflects the group the user actually picked (silver-shoaler →
// "silver swimmer") instead of the broad shape class ("Fish"). These all map to
// the fish shape class in answer-matching's buildShapeClassByForm, so a
// group-level commit still scores shape-class credit (there is no sub-class
// scoring tier). Keyed exhaustively so a new FishGroup forces a noun here.
export const FISH_GROUP_COARSE_NOUN: Record<FishGroup, string> = {
  "cod-like": "cod-shaped fish",
  wrasse: "wrasse",
  "silver-shoaler": "silver swimmer",
  "bottom-sitter": "goby or dragonet",
  "bottom-other": "bottom fish",
  "long-skinny": "long, skinny fish",
  shark: "shark",
};

export const SIZE = ["small", "medium", "large"] as const; // <10cm, 10-50cm, >50cm
export type SizeClass = (typeof SIZE)[number];

// Body depth — the Rung-3 splitter for the over-stuffed fusiform pool (added
// 3 Jun 2026). Deep-bodied fish (bib, ballan/corkwing wrasse) vs slim torpedoes
// (pollack, saithe, mackerel) is a question a beginner can answer from the
// silhouette alone, and it is the single most discriminating cut once shape
// class + body shape are fixed. Optional array trait on SpeciesTraits.
export const BODY_DEPTH = ["deep", "medium", "slender"] as const;
export type BodyDepth = (typeof BODY_DEPTH)[number];

// Lateral-line form — a classic field mark, especially for gadoids (pale and
// straight in saithe, dark and curved in pollack) and for the dab (lateral line
// arched sharply over the pectoral fin). Optional array trait.
export const LATERAL_LINE = [
  "pale-straight",
  "dark-curved",
  "arched-over-pectoral",
  "indistinct",
] as const;
export type LateralLine = (typeof LATERAL_LINE)[number];

export const COLORATION = [
  "uniform",
  "mottled",
  "spotted",
  "striped-horizontal",
  "striped-vertical",
  "banded",
  "iridescent",
] as const;
export type Coloration = (typeof COLORATION)[number];

export const MARKINGS = [
  "eye-spot",
  "lateral-stripe",
  "dorsal-spots",
  "fin-spots",
  "caudal-spot", // dark spot on the tail base (corkwing, goldsinny, two-spotted goby)
  "none",
] as const;
export type Marking = (typeof MARKINGS)[number];

export const FIN_SHAPE = [
  "forked-tail",
  "rounded-tail",
  "lyre-shaped",
  "single-dorsal",
  "split-dorsal",
  "long-anal",
  "finlets", // small separate finlets behind the dorsal/anal (mackerel, Scombridae)
] as const;
export type FinShape = (typeof FIN_SHAPE)[number];

export const FEATURES = [
  "barbels",
  "dorsal-spines",
  "fleshy-lips",
  "sucker-mouth",
  "pelvic-sucker", // fused pelvic-disc sucker on the belly — the gobiid give-away
  "lateral-scutes", // bony plates along the lateral line (horse mackerel, Carangidae)
  "frilly-fins",
  "none",
] as const;
export type Feature = (typeof FEATURES)[number];

export const BEHAVIOR = [
  "schooling",
  "solitary",
  "hovering",
  "hiding",
  "burrowing",
  "fast-swim",
  "on-bottom",
] as const;
export type Behavior = (typeof BEHAVIOR)[number];

export const HABITAT = [
  "open-water",
  "kelp",
  "rocky-crevice",
  "sandy-bottom",
  "midwater",
  "near-surface",
] as const;
export type Habitat = (typeof HABITAT)[number];

// Top-level "Spot It" gate. Used as a HARD FILTER (wrong class excluded, not
// down-weighted) by narrow.ts — see Workstream B. Hermit Crab is folded into
// "crab".
export const SHAPE_CLASS = [
  "crab",
  "fish",
  "flatfish",
  "jellyfish",
  "starfish",
  "gastropod",
  "squid",
  "urchin",
  // Catch-all for the non-invertebrate wildlife the cameras also catch
  // (diving seabirds, seals) — added 6 Jul 2026 after two Kelp Crofters clips
  // (KEL33 urchin, KEL37 shag) surfaced with nowhere to go in the gate. Splits
  // on `wildlifeForm` (bird / seal) at Rung 2, same pattern as every other
  // invert class's "form" splitter.
  "other",
] as const;
// NB the `scooter` class (dragonets only) was retired on 3 Jun 2026 and folded
// into `fish`: a downward-looking seabed camera + naive-user testing (Gemini
// vision pass) showed beginners reliably group dragonets with bottom-dwelling
// gobies and tap "Fish", so a hard separate gate made dragonets unreachable for
// no discriminating gain. The dragonets carry `bodyShape: bottom-scooter`, the
// fish Rung-2 sub-split "Bottom scooters" (4 Jun 2026) — which now groups them
// WITH the bottom-dwelling gobies rather than splitting them off, since
// beginners group all the perch-and-dart seabed fish together. Distinct from
// the `flatfish` class (asymmetric, eyes-migrated).
export type ShapeClass = (typeof SHAPE_CLASS)[number];

// Movement is a NORMAL scored trait, not a funnel level. Surfaced by the
// adaptive picker only when it discriminates the remaining candidates.
export const MOVEMENT = [
  "stationary",
  "fits-and-starts",
  "undulating",
  "water-column",
  "drifting",
  "crawl",
] as const;
export type Movement = (typeof MOVEMENT)[number];

// Crab-specific vocabulary. The fish traits above (bodyShape / finShape /
// features / markings) carry no signal for crustaceans, so the crab branch
// discriminates on carapace surface + a small bag of crab give-aways. Both are
// scored as normal array traits (added to TRAIT_KEYS in narrow.ts) but live as
// OPTIONAL fields on SpeciesTraits so the 28 fish entries stay untouched.
export const CARAPACE_TEXTURE = [
  "smooth",
  "warty",
  "pie-crust",
  "furry",
  "corrugated",
] as const;
export type CarapaceTexture = (typeof CARAPACE_TEXTURE)[number];

export const CRAB_FEATURES = [
  "swimming-paddle", // flattened rear-leg paddle (Necora, Liocarcinus)
  "marginal-teeth", // sharp teeth along the carapace edge (Carcinus)
  "long-legs", // spindly spider-crab legs (Hyas)
  "lives-in-shell", // hermit crab, body inside a gastropod shell
  "red-eyes", // velvet swimming crab
  "dark-claw-tips", // black-tipped pincers (Cancer)
  "none",
] as const;
export type CrabFeature = (typeof CRAB_FEATURES)[number];

// Crab body outline — the Rung-2 sub-split for the Crab tile (mirrors the
// invert "form" enums below). One value per crab so a single silhouette tap
// narrows the six crabs to one or two before the photo grid.
export const CRAB_FORM = [
  "broad-carapace", // true crab — wide oval/hexagonal carapace, short legs (Cancer, Carcinus)
  "swimming", // portunid — broad carapace, flattened paddle on the rear legs (Necora, Liocarcinus)
  "spider", // spider crab — triangular carapace, long spindly legs (Hyas)
  "hermit", // hermit crab — soft body inside a coiled gastropod shell (Pagurus)
] as const;
export type CrabForm = (typeof CRAB_FORM)[number];

// Invertebrate vocabulary (Workstream C). Like the crab traits above, the fish
// traits carry no signal here, so each invert gate-class gets one small "form"
// enum that does the within-tile splitting. All are OPTIONAL on SpeciesTraits.

// Cephalopod body plan (Squid tile — octopus folded in per the 1 Jun decision).
export const CEPHALOPOD_FORM = [
  "cuttlefish", // broad flattened mantle, fin skirt the full body length
  "squid", // torpedo mantle, triangular fins at the rear
  "bobtail", // tiny rounded mantle, small ear-like fins, sits on sand
  "octopus", // bulbous head, eight arms, no fins
] as const;
export type CephalopodForm = (typeof CEPHALOPOD_FORM)[number];

// Echinoderm arm plan (Starfish tile).
export const ARM_FORM = [
  "short-stubby", // cushion star — short fat arms, pentagon outline
  "long-spiny", // spiny starfish — long arms with rows of spines
  "long-smooth", // common starfish — long tapering arms, no obvious spines
  "thin-whippy", // brittlestar — small disc, long thread-like arms
] as const;
export type ArmForm = (typeof ARM_FORM)[number];

// Gastropod shell plan (Snail / slug tile).
export const SHELL_SHAPE = [
  "flat-cone", // limpet — low cone clamped to rock
  "pointed-cone", // top shells, dog whelk — tall pointed spire
  "rounded-squat", // periwinkle, flat top shell — squat rounded whorl
  "no-shell", // sea slug / nudibranch — naked body (future entries)
] as const;
export type ShellShape = (typeof SHELL_SHAPE)[number];

// Jellyfish bell plan (Jellyfish tile).
export const BELL_FORM = [
  "saucer", // domed saucer bell with short marginal tentacles (moon, compass, blue)
  "frilly-arms", // solid bell + frilly mouth-arms, no long tentacles (barrel)
  "trailing-mass", // bell trailing a dense mass of long tentacles (lion's mane)
] as const;
export type BellForm = (typeof BELL_FORM)[number];

// Echinoid body plan (Sea Urchin tile). The real Regularia/Irregularia split:
// round spiny grazers versus flattened burrowers that live under the sand.
export const URCHIN_FORM = [
  "round-spiny", // regular echinoid — globe-shaped test, spines all round (Echinus, Psammechinus, Paracentrotus)
  "heart-shaped", // irregular echinoid — flattened, fur-like short spines, burrows in sand/mud (Echinocardium, Spatangus)
] as const;
export type UrchinForm = (typeof URCHIN_FORM)[number];

// Other Wildlife body plan (the catch-all tile). Bird vs seal is the only cut
// this shape class needs at Rung 2 — each side is small enough to go straight
// to the Rung-3 photo grid with no further split.
export const WILDLIFE_FORM = ["bird", "seal"] as const;
export type WildlifeForm = (typeof WILDLIFE_FORM)[number];

export type SpeciesTraits = {
  commonName: string;
  shapeClass: ShapeClass;
  bodyShape: BodyShape[];
  size: SizeClass;
  coloration: Coloration[];
  markings: Marking[];
  finShape: FinShape[];
  features: Feature[];
  behavior: Behavior[];
  habitat: Habitat[];
  movement: Movement[];
  // Fish Rung-2 family grouping (optional): the authoritative gate cut for fish,
  // present on every fish entry, absent on inverts.
  fishGroup?: FishGroup[];
  // Fish Rung-3 splitters (optional): present on fish entries that need them to
  // separate within an over-stuffed body-shape bucket, absent elsewhere.
  bodyDepth?: BodyDepth[];
  lateralLine?: LateralLine[];
  // Crab-only (optional): present on crustacean entries, absent on fish.
  carapaceTexture?: CarapaceTexture[];
  crabFeatures?: CrabFeature[];
  crabForm?: CrabForm[];
  // Invertebrate-only (optional): one "form" enum per non-crab invert tile.
  cephalopodForm?: CephalopodForm[];
  armForm?: ArmForm[];
  shellShape?: ShellShape[];
  bellForm?: BellForm[];
  urchinForm?: UrchinForm[];
  wildlifeForm?: WildlifeForm[];
  fieldNote: string;
};

export type SpeciesCatalogue = Record<string /* scientificName */, SpeciesTraits>;

export type TraitSelection = {
  shapeClass?: ShapeClass[];
  bodyShape?: BodyShape[];
  size?: SizeClass[];
  coloration?: Coloration[];
  markings?: Marking[];
  finShape?: FinShape[];
  features?: Feature[];
  behavior?: Behavior[];
  habitat?: Habitat[];
  movement?: Movement[];
  fishGroup?: FishGroup[];
  bodyDepth?: BodyDepth[];
  lateralLine?: LateralLine[];
  carapaceTexture?: CarapaceTexture[];
  crabFeatures?: CrabFeature[];
  crabForm?: CrabForm[];
  cephalopodForm?: CephalopodForm[];
  armForm?: ArmForm[];
  shellShape?: ShellShape[];
  bellForm?: BellForm[];
  urchinForm?: UrchinForm[];
  wildlifeForm?: WildlifeForm[];
};

export const TRAIT_CATEGORIES = {
  bodyShape: BODY_SHAPE,
  size: SIZE,
  coloration: COLORATION,
  markings: MARKINGS,
  finShape: FIN_SHAPE,
  features: FEATURES,
  behavior: BEHAVIOR,
  habitat: HABITAT,
} as const;
