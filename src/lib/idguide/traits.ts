export const BODY_SHAPE = [
  "elongated",
  "fusiform",
  "laterally-compressed",
  "flat-dorsoventral",
  "eel-like",
  "snake-like",
] as const;
export type BodyShape = (typeof BODY_SHAPE)[number];

export const SIZE = ["small", "medium", "large"] as const; // <10cm, 10-50cm, >50cm
export type SizeClass = (typeof SIZE)[number];

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
] as const;
export type FinShape = (typeof FIN_SHAPE)[number];

export const FEATURES = [
  "barbels",
  "dorsal-spines",
  "fleshy-lips",
  "sucker-mouth",
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
  "scooter",
  "jellyfish",
  "starfish",
  "gastropod",
  "squid",
] as const;
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
  // Crab-only (optional): present on crustacean entries, absent on fish.
  carapaceTexture?: CarapaceTexture[];
  crabFeatures?: CrabFeature[];
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
  carapaceTexture?: CarapaceTexture[];
  crabFeatures?: CrabFeature[];
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
