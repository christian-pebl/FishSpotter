/**
 * Side-by-side "tell them apart" comparison groups (18 Jun 2026).
 *
 * Some Rung-3 candidate sets are genuine look-alikes a beginner cannot separate
 * from a single photo. For those, the candidate gate offers a "Compare side by
 * side" view that lines the look-alikes up with the ONE cue that separates each,
 * drawn from UK ID guides and agency species pages.
 *
 * Each member's `headline` is the single most diagnostic, video-visible cue; the
 * `also` line adds the supporting features. `tip` is the quickest decision route
 * across the whole group; `caveat` flags any real-world trap (hybrids, sex
 * dimorphism, pairs that genuinely cannot be split on video).
 *
 * The fish groups mirror the Rung-2 `fishGroup` cuts, so a group's members ARE
 * the Rung-3 candidate set for that tile. Cues were compiled from MarLIN,
 * FishBase, the Wildlife Trusts, and the local UK guides (Sussex IFCA, ZSL), all
 * cross-checked; see implementation/2026-06-18/flatfish-comparison.md and
 * fish-comparisons.md for the per-species sourcing.
 */

export type ComparisonMember = {
  scientificName: string;
  commonName: string;
  /** The single most diagnostic, video-visible cue for this species. */
  headline: string;
  /** Supporting visible features. */
  also: string;
};

export type ComparisonSource = {
  label: string;
  /** Public URL, or "" for a local/offline reference (rendered as plain text). */
  url: string;
};

export type ComparisonGroup = {
  id: string;
  /** Gate-style question shown at the top of the compare view. */
  title: string;
  /** One or two sentences on why they're confused + the fastest single check. */
  intro: string;
  members: ComparisonMember[];
  /** Plain-English "quickest way to tell all of them apart". */
  tip: string;
  /** Optional real-world trap to flag (hybrids, reversed individuals, etc.). */
  caveat?: string;
  sources: ComparisonSource[];
};

const MARLIN: ComparisonSource = { label: "MarLIN", url: "https://www.marlin.ac.uk" };
const FISHBASE: ComparisonSource = { label: "FishBase", url: "https://www.fishbase.se" };
const WILDLIFE_TRUSTS: ComparisonSource = {
  label: "The Wildlife Trusts",
  url: "https://www.wildlifetrusts.org",
};
const SUSSEX_IFCA: ComparisonSource = { label: "Sussex IFCA Fish ID Guide", url: "" };

export const COMPARISON_GROUPS: ComparisonGroup[] = [
  {
    id: "flatfish-right-eyed",
    title: "Plaice, dab or flounder?",
    intro:
      "All three are right-eyed flatfish that change colour to match the seabed, so colour alone will not decide it. The quickest single check is the lateral line where it passes over the pectoral fin.",
    members: [
      {
        scientificName: "Pleuronectes platessa",
        commonName: "Plaice",
        headline: "Bold, bright orange spots on smooth skin.",
        also: "A row of bony knobs runs from between the eyes back toward the gill cover (clearest on bigger fish). The lateral line is only gently curved.",
      },
      {
        scientificName: "Limanda limanda",
        commonName: "Dab",
        headline: 'Lateral line arches in a high half-circle (a "D") over the pectoral fin.',
        also: "Skin looks rough and sandy rather than glossy. Pale and mottled with faint spots at most, and it is the smallest of the three.",
      },
      {
        scientificName: "Platichthys flesus",
        commonName: "Flounder",
        headline: "Rough, prickly ridges along the bases of the top and bottom fins.",
        also: "Duller brown with muddy reddish spots, and a nearly straight lateral line. The one you meet in estuaries and brackish water.",
      },
    ],
    tip: 'Lateral line loops up like a "D" over the pectoral fin? Dab. Nearly straight, with bright orange spots and smooth skin? Plaice. Nearly straight, with duller spots and rough ridges along the fin edges (often in an estuary)? Flounder.',
    caveat:
      "Plaice and flounder can hybridise, so weigh two or three cues before you commit rather than relying on one.",
    sources: [SUSSEX_IFCA, MARLIN],
  },

  {
    id: "cod-like-gadoids",
    title: "Which cod-shaped fish?",
    intro:
      "Six chunky fish, all with three dorsal fins. Check the chin first: a long barbel (whisker) means cod, bib or poor cod; no barbel means pollack, saithe or whiting.",
    members: [
      {
        scientificName: "Pollachius pollachius",
        commonName: "Pollack",
        headline: "No chin barbel, a jutting lower jaw, and a dark lateral line kinked over the pectoral fin.",
        also: "Slim body, dark back with yellow streaks; no spot at the pectoral base.",
      },
      {
        scientificName: "Pollachius virens",
        commonName: "Saithe",
        headline: "Pale, almost white, nearly straight lateral line from head to tail.",
        also: "Jaws about equal; any chin barbel is tiny and usually invisible; forked tail.",
      },
      {
        scientificName: "Gadus morhua",
        commonName: "Atlantic cod",
        headline: "A long chin barbel plus a pale lateral line that curves over the pectoral.",
        also: "Heavy, mottled, spotty body; upper jaw overhangs the lower; the biggest of the six.",
      },
      {
        scientificName: "Merlangius merlangus",
        commonName: "Whiting",
        headline: "Slim and silvery, no real barbel, with a small dark spot at the pectoral base.",
        also: "Upper jaw slightly overhangs the lower; large eye; sleek and pale.",
      },
      {
        scientificName: "Trisopterus luscus",
        commonName: "Bib",
        headline: "Deep, coppery, almost bream-shaped body with pale vertical bands and a long barbel.",
        also: "The deepest body of the group; a dark blotch at the pectoral base.",
      },
      {
        scientificName: "Trisopterus minutus",
        commonName: "Poor cod",
        headline: "Small, plain coppery fish with a big eye and a long barbel, but no bands.",
        also: "The smallest gadoid; slimmer than bib; dark spot at the pectoral base.",
      },
    ],
    tip: "Long chin barbel? Cod (big, spotty, pale curved line), bib (deep, copper bars), or poor cod (small, big-eyed, plain). No barbel? Pollack (dark kinked lateral line, jutting jaw), saithe (pale straight line), or whiting (slim, silvery, dark pectoral spot).",
    caveat:
      "The dark pectoral-base spot is shared by bib, whiting and poor cod, so pair it with body shape rather than relying on it alone.",
    sources: [SUSSEX_IFCA, MARLIN, FISHBASE],
  },

  {
    id: "wrasse",
    title: "Which wrasse?",
    intro:
      "Two big colourful ones (ballan, cuckoo) and two small brown ones (corkwing, goldsinny). For the small pair, the deciding cue is where the dark spot sits on the tail base.",
    members: [
      {
        scientificName: "Labrus bergylta",
        commonName: "Ballan wrasse",
        headline: "The biggest UK wrasse: heavy body, thick lips, a freckled green-brown to red flank.",
        also: "Each scale has a pale centre, giving an all-over speckled look; no eye-comma and no tail spot.",
      },
      {
        scientificName: "Labrus mixtus",
        commonName: "Cuckoo wrasse",
        headline: "Male: electric blue zigzags on bright orange. Female: pinkish with 2 to 3 dark blotches under the rear dorsal fin.",
        also: "Strong sex difference, so both looks are the same species; slim, elegant body.",
      },
      {
        scientificName: "Symphodus melops",
        commonName: "Corkwing wrasse",
        headline: "A dark comma behind the eye, plus a dark spot in the MIDDLE of the tail base.",
        also: "Small, deep body; maze-like blue-green lines on the head, brighter in males.",
      },
      {
        scientificName: "Ctenolabrus rupestris",
        commonName: "Goldsinny wrasse",
        headline: "Small and reddish, with one bold dark spot at the TOP of the tail base.",
        also: "The smallest wrasse; often a second dark spot on the front of the dorsal fin; no eye-comma.",
      },
    ],
    tip: "Big with thick lips and a freckled body? Ballan. Blue-and-orange, or orange with dark blotches under the back fin? Cuckoo. Small brown one: comma behind the eye plus a spot in the MIDDLE of the tail = corkwing; spot at the TOP of the tail and no comma = goldsinny.",
    caveat:
      "Cuckoo wrasse males and females look nothing alike (blue-orange male versus orange-blotched female), but both are the same species.",
    sources: [MARLIN, WILDLIFE_TRUSTS, FISHBASE],
  },

  {
    id: "gobies-dragonets",
    title: "Which little seabed fish?",
    intro:
      "First sort the shape: a flattened, wide triangular head with eyes on top, lying on sand, is a dragonet; a round-bodied little fish propped on its fins is a goby. The small pale gobies often cannot be split on video, so \"a small goby\" is a fair answer.",
    members: [
      {
        scientificName: "Callionymus lyra",
        commonName: "Dragonet",
        headline: "Flattened, triangular-headed fish on sand, eyes on top; males raise a tall sail-like front fin.",
        also: "Broad fanned fins, long snout, often half-buried; the biggest of this group.",
      },
      {
        scientificName: "Callionymus maculatus",
        commonName: "Spotted dragonet",
        headline: "Smaller dragonet shape with rows of dark or blue spots along the fins.",
        also: 'Shorter snout than the common dragonet; deeper sandy ground; "a dragonet" is a fair fallback.',
      },
      {
        scientificName: "Gobiusculus flavescens",
        commonName: "Two-spotted goby",
        headline: "Hovers UP in midwater, not on the bottom, with a dark spot at the tail base.",
        also: "Reddish and slender, among kelp and seagrass; males add a spot behind the pectoral fin.",
      },
      {
        scientificName: "Gobius paganellus",
        commonName: "Rock goby",
        headline: "Dark, chunky goby on rock with a pale upper edge to the front dorsal fin.",
        also: "Robust, mottled brown; in rockpools and under stones; the largest goby here.",
      },
      {
        scientificName: "Pomatoschistus minutus",
        commonName: "Sand goby",
        headline: "Pale sandy goby on open sand; males show an eye-like spot on the front dorsal fin.",
        also: 'Hard to separate from the common goby on video; if unsure, log "a small goby".',
      },
      {
        scientificName: "Pomatoschistus microps",
        commonName: "Common goby",
        headline: "Tiny pale goby of estuaries and shallows; rarely separable from the sand goby.",
        also: 'Sometimes a dark mark at the top of the pectoral base; default to "a small goby".',
      },
    ],
    tip: 'Wide flat head, eyes on top, on sand = a dragonet. Hovering up in midwater = two-spotted goby. Dark and chunky on rock with a pale-edged fin = rock goby. Pale on open sand = a small goby (sand or common, often not separable, so "a small goby" is fine).',
    caveat:
      "The common and sand gobies are genuinely hard to tell apart on video; experts use features you cannot see in a clip, so a coarse \"small goby\" is the honest call.",
    sources: [MARLIN, FISHBASE],
  },

  {
    id: "bottom-other",
    title: "Which bottom fish?",
    intro:
      "Three are instant: chin whiskers = red mullet; a smooth scaleless rockpool fish with no belly fins = shanny; a squat big-headed fish with a long cheek spine = sea scorpion. The other four are gurnards, split by the colour of their big wing-like pectoral fins.",
    members: [
      {
        scientificName: "Chelidonichthys lucerna",
        commonName: "Tub gurnard",
        headline: "Huge wing-like pectoral fins with a vivid blue margin and blue-green spots.",
        also: "Largest gurnard, reddish body; fans the big fins open like wings.",
      },
      {
        scientificName: "Chelidonichthys cuculus",
        commonName: "Red gurnard",
        headline: "Uniform red body with a row of distinct bony plates along the lateral line.",
        also: "Steep, blunt, angular head; plainer pectoral fins than tub, with no blue edge.",
      },
      {
        scientificName: "Eutrigla gurnardus",
        commonName: "Grey gurnard",
        headline: "Grey-brown body with a dark blotch on the first dorsal fin and white spots on the back.",
        also: "Slimmer and duller than the red and tub; sharply pointed snout.",
      },
      {
        scientificName: "Chelidonichthys lastoviza",
        commonName: "Streaked gurnard",
        headline: "Body crossed by oblique dark bars, with a short, steep, rounded snout.",
        also: "Skin ridges run off the lateral line; reddish above, pale below.",
      },
      {
        scientificName: "Mullus surmuletus",
        commonName: "Red mullet",
        headline: "Two long whisker-like barbels under the chin; nothing else here has them.",
        also: "Pinkish-red with yellow flank stripes; probes the sand with the barbels.",
      },
      {
        scientificName: "Taurulus bubalis",
        commonName: "Long-spined sea scorpion",
        headline: "Squat ambush fish with a big bony head and one long spine on the cheek.",
        also: "Heavily mottled to match the rock; a small barbel at each corner of the mouth.",
      },
      {
        scientificName: "Lipophrys pholis",
        commonName: "Shanny",
        headline: "Smooth, scaleless blenny with one long dorsal fin and no belly fins.",
        also: "Blunt rounded head, no head tentacles; usually wedged in a rockpool.",
      },
    ],
    tip: "Chin whiskers = red mullet. Smooth, no belly fins, in a rockpool = shanny. Long cheek spine and a big head = sea scorpion. Otherwise it is a gurnard: blue fin edge = tub; bony-plated red flank = red; black mark on the front fin = grey; dark slanting body bars = streaked.",
    caveat:
      "Tub and streaked gurnards both show blue on the fins, so split them by the body: tub has a clean reddish body, streaked is crossed by dark bars.",
    sources: [MARLIN, FISHBASE, WILDLIFE_TRUSTS],
  },

  {
    id: "silver-swimmers",
    title: "Which silver swimmer?",
    intro:
      "Slim silvery midwater fish. Look at the back and the side: tiger bars, a bony scute-line, two separate dorsal fins, or a thick lip each point to a different fish.",
    members: [
      {
        scientificName: "Scomber scombrus",
        commonName: "Atlantic mackerel",
        headline: "Wavy dark tiger bars over a green-blue back, with small finlets before the tail.",
        also: "No bony scutes and no gill-cover spot; two widely spaced dorsal fins; forked tail.",
      },
      {
        scientificName: "Trachurus trachurus",
        commonName: "Atlantic horse mackerel",
        headline: "A hard scute-line that kinks sharply down to the tail, a big eye, and a dark gill-cover spot.",
        also: "No tiger bars; first dorsal tall and spiny; also called scad.",
      },
      {
        scientificName: "Dicentrarchus labrax",
        commonName: "European sea bass",
        headline: "Clean silver body, two clearly separate dorsal fins (front spiny), and a dark gill-cover spot.",
        also: "Spiny, saw-toothed lower gill edge; pointed mouth; sturdy body.",
      },
      {
        scientificName: "Chelon labrosus",
        commonName: "Thick-lipped mullet",
        headline: "Blunt rounded head with a thick fat upper lip; plain grey, no scutes.",
        also: "Two well-spaced dorsal fins; faint grey stripes along the flanks; small upturned mouth.",
      },
      {
        scientificName: "Atherina presbyter",
        commonName: "Sand smelt",
        headline: "Slender, see-through body with a bright silver stripe down the mid-flank.",
        also: "Two dorsal fins; large eye; translucent fins.",
      },
      {
        scientificName: "Sprattus sprattus",
        commonName: "Sprat",
        headline: "Small fish with a sharp saw-edged keeled belly and a single dorsal fin.",
        also: "Greyish back; no obvious side-line; the belly keel shows in silhouette.",
      },
    ],
    tip: "Wavy tiger bars and finlets = mackerel. Bony scute-line kinked to the tail plus a gill spot = scad (horse mackerel). Clean silver with two separate dorsals and a gill spot = bass. Blunt, thick-lipped head = grey mullet. The tiny ones: one dorsal and a saw-edged belly = sprat; two dorsals, see-through, with a silver stripe = sand smelt.",
    caveat:
      "The dark gill-cover spot is on both scad and bass, so split those two by the scute-line (scad) versus the spiny gill edge and two clean dorsals (bass).",
    sources: [MARLIN, FISHBASE],
  },

  {
    id: "long-skinny",
    title: "Which long, skinny fish?",
    intro:
      "Three very different long fish. Build decides it: a big thick smooth eel, a small flat ribbon, or a thread-thin fish with a long snout.",
    members: [
      {
        scientificName: "Conger conger",
        commonName: "Conger eel",
        headline: "Big, thick, scaleless grey eel; the dorsal fin starts just behind the pectoral fins.",
        also: "No belly fins; large mouth with the upper jaw overhanging; far bigger than the others, often about 2 m.",
      },
      {
        scientificName: "Pholis gunnellus",
        commonName: "Butterfish",
        headline: "Small flat ribbon with a row of white-ringed black eyespots along the dorsal fin.",
        also: "About 9 to 13 spots; very slippery; a dark band through the eye; usually under stones.",
      },
      {
        scientificName: "Spinachia spinachia",
        commonName: "Fifteen-spined stickleback",
        headline: "Thread-thin fish with a long pointed snout and a very narrow tail stalk.",
        also: "A row of about 15 tiny separate spines before the small dorsal fin; among seaweed and seagrass.",
      },
    ],
    tip: "Big, thick, smooth grey eel = conger. Small flat ribbon with a line of pale-ringed dark dots = butterfish. Tiny, super-skinny, with a long pointed snout and a row of little back-spines = fifteen-spined stickleback.",
    sources: [MARLIN, FISHBASE],
  },
];

/**
 * The comparison group for a Rung-3 candidate set, or null. A group applies when
 * every one of its members is present among the candidates AND the candidate set
 * is small enough to be dominated by the group (so the whole-catalogue "Not sure"
 * path, which also contains all the members, does not surface it). The threshold
 * (members + 3) keeps it to a genuinely narrow, look-alike set.
 */
export function comparisonGroupForCandidates(
  scientificNames: string[],
): ComparisonGroup | null {
  const set = new Set(scientificNames);
  for (const g of COMPARISON_GROUPS) {
    const allPresent = g.members.every((m) => set.has(m.scientificName));
    if (allPresent && scientificNames.length <= g.members.length + 3) return g;
  }
  return null;
}
