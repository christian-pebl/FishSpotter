import type { ShapeClass } from "@/lib/idguide/traits";

/**
 * Group-level "how to recognise this shape class" guides, shown by the
 * "How to spot a [X] next time" flow when the clip's reference is a coarse group
 * label (e.g. "Flatfish", "Fish") rather than a single species. Per-species
 * content (diagnostic marks + field notes) lives in the catalogue; this is the
 * one-rung-up teaching layer.
 *
 * DRAFT content (2026-06-11). Grounded in decision-tree/id-guides + general UK
 * marine ID; pending marine-biologist sign-off, same bar as the per-species
 * field notes and diagnostic marks.
 */
export type ShapeClassGuide = {
  /** Friendly group name for headings. */
  label: string;
  /** One-sentence framing of the group. */
  intro: string;
  /** 2-4 at-a-glance recognition cues. */
  cues: string[];
  /** One line on telling the members of the group apart. */
  tellApart: string;
};

export const SHAPE_CLASS_GUIDES: Record<ShapeClass, ShapeClassGuide> = {
  fish: {
    label: "Fish",
    intro: "Most fish here are streamlined swimmers up in the water column.",
    cues: [
      "Streamlined body, the same on both sides (left mirrors right)",
      "Swims upright, fins held out to balance and steer",
      "One eye on each side of the head",
      "A single tail fin that drives it along",
    ],
    tellApart:
      "Body depth, fin shape and any stripes or spots separate the species, a deep round wrasse versus a slim sandeel.",
  },
  flatfish: {
    label: "Flatfish",
    intro: "Flatfish lie on the seabed rather than swimming in open water.",
    cues: [
      "Lies flat on the bottom, often half-buried in sand",
      "Both eyes sit on the upper side of the body",
      "A flat, diamond or oval outline",
      "A fringe of fin runs the whole way around the edge",
    ],
    tellApart:
      "Plaice show bright orange spots, dab has rougher skin, flounder a row of bony bumps along the back.",
  },
  crab: {
    label: "Crab",
    intro: "Crabs are armoured animals that walk across the seabed.",
    cues: [
      "A hard, wide shell (carapace) over the body",
      "The front pair of legs ends in pincers (claws)",
      "Walks sideways on jointed legs",
      "Small eyes on short stalks and two stubby antennae",
    ],
    tellApart:
      "The shell edge tells them apart, the pie-crust rim of an edible crab versus the flat back paddles of a swimming crab.",
  },
  jellyfish: {
    label: "Jellyfish",
    intro: "Jellyfish drift and gently pulse, with no hard parts at all.",
    cues: [
      "A soft, see-through bell that pulses to move",
      "Trailing tentacles or frilly arms hanging beneath",
      "Wheel-like symmetry, with no left or right side",
      "Drifts with the current rather than steering",
    ],
    tellApart:
      "Look at the bell, the four pale rings of a moon jelly versus the solid dome and cauliflower arms of a barrel jelly.",
  },
  starfish: {
    label: "Starfish & urchin",
    intro:
      "Starfish, brittlestars and sea urchins are slow-moving, spiny-skinned animals of rock and sand (echinoderms) — some star-shaped, some a round spiny ball.",
    cues: [
      "A star outline (usually five arms), OR a round or oval ball with no arms at all",
      "Sits flat on the bottom and moves very slowly",
      "A rough, knobbly or spiny upper surface",
      "Rows of tiny tube feet underneath",
    ],
    tellApart:
      "Arms or no arms is the first split. Among the star-shaped ones, arm length and texture separate them (short fat arms of a cushion star versus the long spiny arms of a spiny starfish); among the round ones, a solid spiny ball is a regular sea urchin, an oval fur-spined one is a heart urchin.",
  },
  gastropod: {
    label: "Snail or slug",
    intro: "Sea snails and sea slugs creep along on a single muscular foot.",
    cues: [
      "A single coiled shell (snail), or a soft shell-less body (sea slug)",
      "Glides slowly on one muscular foot",
      "A pair of tentacles on the head",
      "Usually grazing over rock or seaweed",
    ],
    tellApart:
      "For snails it is the shell shape; for sea slugs it is the colour and the gills or horns carried on the back.",
  },
  squid: {
    label: "Squid or octopus",
    intro: "Squid, cuttlefish and octopus are soft-bodied with many arms.",
    cues: [
      "A soft body with eight arms (squid and cuttlefish add two long tentacles)",
      "Large, expressive eyes",
      "Moves by jetting water, can hover then dart",
      "Can change colour and skin texture in an instant",
    ],
    tellApart:
      "Body plan tells them apart, the torpedo body and side fins of a squid versus the round folded body of an octopus.",
  },
  wildlife: {
    label: "Other wildlife",
    intro:
      "Not every camera clip is a fish or marine invertebrate — air-breathing visitors like diving seabirds and seals turn up too.",
    cues: [
      "Comes up for air rather than breathing underwater",
      "Diving birds: streamlined body, paddling feet, often a long neck",
      "Seals: torpedo body, whiskered face, front and rear flippers",
      "Moves with real speed and purpose compared to most fish",
    ],
    tellApart:
      "Feathers and paddling feet mean a diving bird; a whiskered face and flippers mean a seal.",
  },
};
