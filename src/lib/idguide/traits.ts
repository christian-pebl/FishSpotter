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

export type SpeciesTraits = {
  commonName: string;
  bodyShape: BodyShape[];
  size: SizeClass;
  coloration: Coloration[];
  markings: Marking[];
  finShape: FinShape[];
  features: Feature[];
  behavior: Behavior[];
  habitat: Habitat[];
  fieldNote: string;
};

export type SpeciesCatalogue = Record<string /* scientificName */, SpeciesTraits>;

export type TraitSelection = {
  bodyShape?: BodyShape[];
  size?: SizeClass[];
  coloration?: Coloration[];
  markings?: Marking[];
  finShape?: FinShape[];
  features?: Feature[];
  behavior?: Behavior[];
  habitat?: Habitat[];
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
