import type { TraitKey } from "@/lib/idguide/narrow";

/**
 * ORPHANED (as of 3 Jun 2026): the question copy for the adaptive Rung-3 engine.
 * Live only through the dead `CandidateStrip.tsx` (see the banner in
 * `next-trait.ts`). Paired with `next-trait.ts`; reconnect both together if
 * reviving adaptive narrowing. See docs/runbooks/add-a-rung-or-trait.md.
 *
 * UX-2: human phrasing for the adaptive Rung 3 questions.
 *
 * The information-gain picker (`nextBestTrait`) returns a raw (trait, value)
 * pair like `{ key: "crabFeatures", value: "swimming-paddle" }`. Each Rung 3
 * prompt is a single binary question ("does it have this?"), so we map every
 * value a picker could surface to everyday, jargon-light copy. A de-kebabed
 * fallback keeps any future trait value answerable even before it's curated
 * here.
 */
const QUESTIONS: Partial<Record<TraitKey, Record<string, string>>> = {
  size: {
    small: "Is it small (under about 10 cm)?",
    medium: "Is it medium-sized (roughly 10–50 cm across)?",
    large: "Is it large (over about 50 cm, bigger than a dinner plate)?",
  },
  crabFeatures: {
    "swimming-paddle": "Does the last pair of legs end in flattened swimming paddles?",
    "marginal-teeth": "Does the shell have sharp teeth along each side, behind the eyes?",
    "long-legs": "Does it have long, spindly, spider-like legs?",
    "lives-in-shell": "Is it living inside an empty snail shell?",
    "red-eyes": "Does it have bright red eyes?",
    "dark-claw-tips": "Are the pincer tips black?",
    none: "Is it a plain crab — no swimming paddle, long spider legs, shell home or red eyes?",
  },
  crabForm: {
    "broad-carapace": "Is it a broad oval crab with a wide shell and short legs?",
    swimming: "Does the last pair of legs end in flattened swimming paddles?",
    spider: "Is it a spider crab — triangular shell with long spindly legs?",
    hermit: "Is it a hermit crab, living inside an empty snail shell?",
  },
  carapaceTexture: {
    smooth: "Is the shell smooth?",
    warty: "Is the shell knobbly or warty?",
    "pie-crust": "Does the shell edge look like a crimped pie-crust?",
    furry: "Is the shell covered in fine velvety fur?",
    corrugated: "Is the shell ridged or corrugated?",
  },
  cephalopodForm: {
    cuttlefish: "Is the body a broad flattened oval with a fin running the whole way round?",
    squid: "Is the body a slender torpedo with two triangular fins at the tail end?",
    bobtail: "Is it tiny and rounded with small ear-like fins, sitting on the sand?",
    octopus: "Does it have a soft bulbous head and eight arms, with no fins?",
  },
  armForm: {
    "short-stubby": "Does it have five short stubby arms (a cushiony, pentagon outline)?",
    "long-spiny": "Does it have long arms covered in rows of spines?",
    "long-smooth": "Does it have long tapering arms with no obvious spines?",
    "thin-whippy": "Does it have a small central disc with long thread-like arms?",
    "round-spiny": "Is it a round spiny ball with no arms at all, like a pincushion?",
    "heart-shaped": "Is it an oval or heart-shaped body with a fine fur of short spines?",
  },
  wildlifeForm: {
    "diving-bird": "Is it a bird — a streamlined diving shape with paddling feet, no flippers?",
    pinniped: "Is it a seal — a torpedo-shaped body with a whiskered head and flippers?",
  },
  shellShape: {
    "flat-cone": "Is the shell a low cone clamped down onto the rock (limpet-like)?",
    "pointed-cone": "Is the shell a tall pointed spire?",
    "rounded-squat": "Is the shell a squat rounded whorl?",
    "no-shell": "Is it a naked slug-like body with no shell?",
  },
  bellForm: {
    saucer: "Is it a domed saucer-shaped bell with only short fringing tentacles?",
    "frilly-arms": "Is it a solid bell with frilly cauliflower-like arms and no long tentacles?",
    "trailing-mass": "Is it trailing a dense mass of long stinging tentacles?",
  },
  coloration: {
    uniform: "Is it a fairly plain, uniform colour?",
    mottled: "Is it mottled or blotchy?",
    spotted: "Is it covered in spots?",
    "striped-horizontal": "Does it have stripes running head-to-tail?",
    "striped-vertical": "Does it have stripes running top-to-bottom?",
    banded: "Does it have bold bands across the body?",
    iridescent: "Does it have shiny, iridescent blue markings?",
    none: "Is it plain and unremarkable, with no obvious pattern, spots or stripes?",
  },
  habitat: {
    "open-water": "Is it out in open water?",
    kelp: "Is it in kelp or weed?",
    "rocky-crevice": "Is it in a rocky crevice or under rocks?",
    "sandy-bottom": "Is it on a sandy or muddy bottom?",
    midwater: "Is it hovering in mid-water?",
    "near-surface": "Is it near the surface?",
  },
  behavior: {
    schooling: "Is it in a school or shoal?",
    solitary: "Is it on its own?",
    hovering: "Is it hovering still?",
    hiding: "Is it tucked into a hole or crevice, with only part of its body showing?",
    burrowing: "Is it burrowing into the bottom?",
    "fast-swim": "Is it swimming fast?",
    "on-bottom": "Is it resting on the bottom?",
  },
  movement: {
    stationary: "Is it staying still?",
    "fits-and-starts": "Does it move in short fits and starts?",
    undulating: "Does it move with a wavy, undulating motion?",
    "water-column": "Is it swimming up in the water?",
    drifting: "Is it drifting passively with the current?",
    crawl: "Is it crawling along the bottom?",
  },
  fishGroup: {
    "cod-like": "Is it a chunky, blunt-nosed fish hanging over the reef, with three separate fins along its back?",
    wrasse: "Is it a deep, thick-lipped fish pottering in the rocks, with one long fin down its back?",
    "silver-shoaler": "Is it a slim, bright-silver fish out in open water (often in a shoal)?",
    "bottom-sitter": "Is it a small, smooth goby or dragonet perched on the seabed, darting in short hops?",
    "bottom-other": "Is it a chunkier or odd-looking bottom fish — a gurnard, red mullet, sea scorpion or blenny — rather than a small goby or dragonet?",
    "long-skinny": "Is the body eel-like — much longer than it is deep?",
    shark: "Does it look like a little shark?",
  },
  bodyShape: {
    fusiform: "Is it a normal fish silhouette — torpedo or deep-bodied (not eel, flat, or bottom-hugging)?",
    elongated: "Is the body long and slender?",
    "flat-dorsoventral": "Is the body flattened top-to-bottom, lying flat?",
    "eel-like": "Is the body eel-like?",
    "bottom-scooter": "Does it rest on the bottom and dart in fits and starts (goby or dragonet)?",
  },
  bodyDepth: {
    deep: "Is it a deep-bodied, tall fish (clearly taller than a torpedo)?",
    medium: "Is it a medium-built fish — neither slim nor especially deep?",
    slender: "Is it a slim, slender-bodied fish?",
  },
  lateralLine: {
    "pale-straight": "Is there a pale, nearly straight line along the side?",
    "dark-curved": "Is there a dark line along the side that curves downwards?",
    "arched-over-pectoral": "Does the side-line arch sharply up over the pectoral fin?",
    indistinct: "Is the side-line faint or hard to see?",
  },
  markings: {
    "eye-spot": "Does it have an eye-spot (a dark ringed dot)?",
    "lateral-stripe": "Does it have a stripe along its side?",
    "dorsal-spots": "Does it have spots on the body or back?",
    "fin-spots": "Does it have spots on the fins?",
    "caudal-spot": "Is there a dark spot at the base of the tail?",
    none: "Is it plain, with no obvious markings?",
  },
  finShape: {
    "forked-tail": "Does it have a deeply forked tail?",
    "rounded-tail": "Does it have a rounded, paddle-shaped tail?",
    "lyre-shaped": "Does it have a lyre-shaped tail?",
    "single-dorsal": "Does it have one long continuous dorsal fin?",
    "split-dorsal": "Does it have two or three separate dorsal fins?",
    "long-anal": "Does it have a long anal fin?",
    finlets: "Are there small separate finlets behind the dorsal and tail fins?",
  },
  features: {
    barbels: "Does it have a barbel (whisker) under the chin?",
    "dorsal-spines": "Does it have spiny dorsal fins?",
    "fleshy-lips": "Does it have thick, fleshy lips?",
    "sucker-mouth": "Does it have a sucker-like mouth?",
    "pelvic-sucker": "Does it have a round sucker on its belly (fins fused into a disc)?",
    "lateral-scutes": "Is there a row of bony plates along the side?",
    "frilly-fins": "Does it have frilly or feathery fins?",
    none: "Is it plain-headed — no barbel, spines, fleshy lips or frilly fins?",
  },
};

function deKebab(value: string): string {
  return value.replace(/-/g, " ");
}

export function traitQuestion(key: TraitKey, value: string): string {
  const curated = QUESTIONS[key]?.[value];
  if (curated) return curated;
  // Every catalogue trait value should have curated copy above; a miss means a
  // new value was added without a question. Warn in dev, and keep the fallback
  // quote-free so it never reads as a raw enum token to the user.
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn(`[trait-questions] no curated question for ${key}="${value}"; using fallback`);
  }
  return `Does it look ${deKebab(value)}?`;
}
