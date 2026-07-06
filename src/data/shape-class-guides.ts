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
    label: "Starfish",
    intro: "Starfish are slow, many-armed animals of rock and sand.",
    cues: [
      "A star outline, usually five arms from a central disc",
      "Sits flat on the bottom and moves very slowly",
      "A rough, knobbly or spiny upper surface",
      "Rows of tiny tube feet underneath each arm",
    ],
    tellApart:
      "Arm length and texture separate them, the short fat arms of a cushion star versus the long arms of a common starfish.",
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
  urchin: {
    label: "Sea Urchin",
    intro: "Sea urchins are spiny-skinned grazers or burrowers of rock and sand.",
    cues: [
      "A hard, round or heart-shaped test (shell) covered in short spines",
      "No head, no legs, just radiating spines and tiny tube feet",
      "Either sits on rock grazing algae, or buried in sand and mud",
      "Moves very slowly, if at all, when out in the open",
    ],
    tellApart:
      "Shape splits them fast, a round ball bristling with long spines versus a flattened, fur-spined heart shape that lives buried in sediment.",
  },
  other: {
    label: "Seabird or Seal",
    intro: "The cameras also catch visiting seabirds and seals, not just fish and invertebrates.",
    cues: [
      "A whole-animal body plan, not a fish, crab or invertebrate",
      "Birds: a streamlined diving body, neck and bill, paddling with webbed feet",
      "Seals: a torpedo body with front and rear flippers, no neck",
      "Both come from above the water to feed, rather than living on the seabed",
    ],
    tellApart:
      "A long neck and a pointed bill means a bird; a thick-necked, flippered body means a seal.",
  },
};
