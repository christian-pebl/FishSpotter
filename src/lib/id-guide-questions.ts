// Static config for the ID Guide question funnel.
// Values must match TaxonAttribute.value in scripts/seed-taxon-attributes.mjs.

export type QuestionKey = "functionalGroup" | "locomotion" | "screenZone" | "bodyShape" | "colorTag";

export interface Option {
  value: string;
  label: string;
  emoji: string;
  hint?: string;
}

export type Answers = Partial<Record<QuestionKey, string>>;

export interface Question {
  key: QuestionKey;
  prompt: string;
  shortPrompt?: string;
  options: Option[];
  optional?: boolean;
  /** When true, this question only renders if some prior answers were given */
  showIf?: (prior: Answers) => boolean;
  /** Replace the static options based on prior answers (used by Q4 body-shape) */
  optionsFor?: (prior: Answers) => Option[];
}

const FISH_BODY_SHAPES: Option[] = [
  { value: "streamlined",     emoji: "🐟", label: "Streamlined / torpedo" },
  { value: "flat",            emoji: "🟫", label: "Flat (lying on side)" },
  { value: "eel-like",        emoji: "🐍", label: "Long & eel-like" },
  { value: "round-globular",  emoji: "🐡", label: "Round / globular" },
];

const CRAB_BODY_SHAPES: Option[] = [
  { value: "squarish",         emoji: "🦀", label: "Squarish / typical crab" },
  { value: "hidden-in-shell",  emoji: "🐚", label: "Hidden in a shell (hermit)" },
  { value: "long-legged",      emoji: "🕷️", label: "Long-legged & spindly" },
];

const JELLY_BODY_SHAPES: Option[] = [
  { value: "bell-shape",  emoji: "🪼", label: "Bell-shaped" },
  { value: "elongated",   emoji: "🎀", label: "Long & elongated" },
  { value: "comb-like",   emoji: "✨", label: "Comb-like / shimmering" },
];

export const QUESTIONS: Question[] = [
  {
    key: "functionalGroup",
    prompt: "What kind of creature is this?",
    shortPrompt: "What kind?",
    options: [
      { value: "fish",       emoji: "🐟", label: "Fish" },
      { value: "crab",       emoji: "🦀", label: "Crab / Lobster" },
      { value: "jellyfish",  emoji: "🪼", label: "Jellyfish" },
      { value: "gastropod",  emoji: "🐚", label: "Whelk / Sea snail" },
      { value: "echinoderm", emoji: "⭐", label: "Starfish / Urchin" },
      { value: "cephalopod", emoji: "🦑", label: "Squid / Octopus" },
      { value: "unsure",     emoji: "❓", label: "Not sure" },
    ],
  },
  {
    key: "locomotion",
    prompt: "How does it move?",
    shortPrompt: "Movement",
    options: [
      { value: "swimming",   emoji: "↗️", label: "Swimming smoothly" },
      { value: "darting",    emoji: "⚡", label: "Darting in bursts" },
      { value: "drifting",   emoji: "🌬️", label: "Drifting passively" },
      { value: "crawling",   emoji: "🐌", label: "Crawling on seabed" },
      { value: "stationary", emoji: "🛌", label: "Sitting still" },
      { value: "hidden",     emoji: "🕳️", label: "Half-buried / hidden" },
    ],
    optional: true,
  },
  {
    key: "screenZone",
    prompt: "Where is it in the frame?",
    shortPrompt: "Position",
    options: [
      { value: "surface",  emoji: "🛟", label: "Near the surface" },
      { value: "midwater", emoji: "🌊", label: "Mid-water" },
      { value: "seabed",   emoji: "🪨", label: "On the seabed" },
    ],
    optional: true,
  },
  {
    key: "bodyShape",
    prompt: "What's its body shape?",
    shortPrompt: "Shape",
    options: FISH_BODY_SHAPES, // default; replaced via optionsFor
    showIf: (prior) =>
      prior.functionalGroup === "fish" ||
      prior.functionalGroup === "crab" ||
      prior.functionalGroup === "jellyfish",
    optionsFor: (prior) => {
      if (prior.functionalGroup === "crab") return CRAB_BODY_SHAPES;
      if (prior.functionalGroup === "jellyfish") return JELLY_BODY_SHAPES;
      return FISH_BODY_SHAPES;
    },
    optional: true,
  },
  {
    key: "colorTag",
    prompt: "What colour is it?",
    shortPrompt: "Colour",
    options: [
      { value: "silvery",     emoji: "🥈", label: "Silvery / metallic" },
      { value: "sandy",       emoji: "🟫", label: "Sandy / brown" },
      { value: "red",         emoji: "🟥", label: "Red / orange" },
      { value: "mottled",     emoji: "🟤", label: "Mottled / camouflaged" },
      { value: "dark",        emoji: "⚫", label: "Dark / black" },
      { value: "striped",     emoji: "🦓", label: "Striped" },
      { value: "translucent", emoji: "👻", label: "Translucent / see-through" },
    ],
    optional: true,
  },
];

/** Compute the ordered question list for a current set of answers (handles showIf). */
export function visibleQuestions(prior: Answers): Question[] {
  return QUESTIONS.filter((q) => !q.showIf || q.showIf(prior));
}
