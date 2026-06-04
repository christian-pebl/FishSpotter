/**
 * Redraft sets for the guide-hero continuation (4 Jun 2026).
 *
 * Two jobs, both consumed by scripts/place-diagnostic-marks.ts author mode with
 * --redraft (which DELETES the species' existing draft marks, then recreates +
 * places this clean set):
 *
 *  1. TRIM over-marked species to a canonical <=3-mark set. Earlier seeding left
 *     duplicate / redundant marks (e.g. European sea bass had "Spiny gill cover"
 *     twice; butterfish/rock goby/horse mackerel carried 6 marks). A clean hero
 *     wants 3 distinct, separating features.
 *  2. RE-ANCHOR two species whose photo cannot show a previously-marked feature
 *     (Flat Top Shell's open navel is on the underside; the Dragonet's tall first
 *     dorsal is folded down), onto features the current photo DOES show.
 *
 * Grounded in the UK guides (decision-tree/id-guides/) + species-traits fieldNotes.
 * All marks are DRAFTS pending expert sign-off. Same voice/length as P2_MARK_DRAFTS.
 */
import type { Feature } from "./p2-mark-drafts";

export const REDRAFTS: Record<string, Feature[]> = {
  // ---- TRIM to a canonical 3-mark set ----
  "Dicentrarchus labrax": [
    {
      label: "Two separate dorsal fins",
      description:
        "A spiny first dorsal fin and a clearly separate soft second dorsal, a perch-family hallmark.",
    },
    {
      label: "Spiny gill-cover edge",
      description:
        "Two flat spines on the rear edge of the gill cover (preopercle); a quick prick-check confirms a bass.",
    },
    {
      label: "Plain silver flanks, dark back",
      description:
        "Clean silver-grey flanks with no bars or spots in adults, scaling up to a darker back.",
    },
  ],
  "Pholis gunnellus": [
    {
      label: "Row of black eye-spots",
      description:
        "A line of white-ringed black ocelli runs along the base of the long dorsal fin; the unmistakable butterfish mark.",
    },
    {
      label: "Long ribbon body",
      description: "A long, flattened, ribbon-like body, slippery to hold, that drapes over rocks.",
    },
    {
      label: "Small blunt head",
      description: "A tiny, blunt head on the slender ribbon; a gentle weed-grazer with no eel-like teeth.",
    },
  ],
  "Gobius paganellus": [
    {
      label: "Pale band on the first dorsal",
      description:
        "A pale orange or yellow band along the top edge of the first dorsal fin; the rock goby's tell.",
    },
    {
      label: "Robust dark mottled body",
      description:
        "A chunky, dark, mottled goby (to ~12 cm), much bigger and darker than the little sand and common gobies.",
    },
    {
      label: "Blunt head, thick lips",
      description: "A broad blunt head with thick lips and eyes set high.",
    },
  ],
  "Hyas araneus": [
    {
      label: "Pear-shaped carapace",
      description: "A triangular, pear-shaped carapace narrowing to the front and broadest towards the rear.",
    },
    {
      label: "Two rostral horns",
      description: "Two short horns (the rostrum) project forward between the eyes at the front of the carapace.",
    },
    {
      label: "Long spindly legs",
      description: "Long, thin, spider-like walking legs, often disguised with attached weed and debris.",
    },
  ],
  "Necora puber": [
    {
      label: "Red eyes",
      description: "Striking red eyes, a quick giveaway against the dark body.",
    },
    {
      label: "Velvety carapace",
      description: "The carapace is covered in fine short hairs giving it a matte, velvet-brown look.",
    },
    {
      label: "Paddle-shaped rear legs",
      description: "The last pair of legs are flattened into swimming paddles, marking it a swimming crab.",
    },
  ],
  "Trachurus trachurus": [
    {
      label: "Bony scute lateral line",
      description:
        "A row of hard, bony, keel-like scutes runs the full length of the lateral line; unmistakable once you know to look.",
    },
    {
      label: "Two separate dorsal fins",
      description:
        "A short spiny first dorsal and a long soft second dorsal, clearly separate, unlike mackerel's continuous fin.",
    },
    {
      label: "Large eye, blunt snout",
      description:
        "A notably large eye and blunt rounded head; metallic silver flanks without mackerel's wavy bars.",
    },
  ],
  "Nucella lapillus": [
    {
      label: "Pointed spire",
      description: "A short, pointed spire of whorls at the top of the thick shell.",
    },
    {
      label: "Thick ridged shell",
      description: "A solid, thick shell with low spiral ridges; colour varies (white, yellow or banded).",
    },
    {
      label: "Oval notched aperture",
      description: "A wide oval opening (aperture) with a short siphonal notch at its base.",
    },
  ],

  // ---- RE-ANCHOR to features the current photo shows ----
  "Steromphala umbilicalis": [
    {
      label: "Flat-topped low cone",
      description: "A low, flat-topped conical shell, broader than it is tall, not a tall pointed cone.",
    },
    {
      label: "Reddish-purple zigzag streaks",
      description: "Diagonal reddish-purple zigzag streaks over a greyish shell (clearest when unworn).",
    },
    {
      label: "Rounded whorls and suture",
      description: "Gently rounded whorls separated by a shallow groove (suture) spiralling up to the apex.",
    },
  ],
  "Callionymus lyra": [
    {
      label: "Flat body on the sand",
      description: "A flattened body that lies pressed to the sand; a scooter, not a free-swimmer.",
    },
    {
      label: "Eyes high on the head",
      description: "Bulging eyes set high on top of the broad, flat head, looking upward.",
    },
    {
      label: "Blue spots and lines (male)",
      description: "Electric-blue spots and wavy lines mark the head and body of the breeding male.",
    },
  ],
};
