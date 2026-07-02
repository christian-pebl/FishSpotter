/**
 * P2 diagnostic-mark drafts: editorial feature lists (label + description ONLY,
 * no coordinates) for catalogue species that lacked authored marks (the 15 with
 * no guide-hero in the 2026-06-04 audit, plus later additions like whiting).
 * scripts/place-diagnostic-marks.ts (author mode) places the ring coordinates
 * with Gemini; this file is just the "what to look for" text. Adding a species
 * here is what makes it eligible for `--mode author` (and the onboard pipeline).
 *
 * Voice + length match scripts/seed-fish-marks.ts. Twelve of these reuse the
 * (sound) draft TEXT that already sat in seed-fish-marks.ts but never inserted
 * (the species was skipped for lacking a curated photo at the time); three
 * (Callionymus maculatus, Limanda limanda, Platichthys flesus) are newly
 * authored here, grounded in the species' fieldNote in species-traits.json and
 * the UK guides in decision-tree/id-guides/.
 *
 * All marks are DRAFTS pending marine-biologist sign-off.
 */

export type Feature = { label: string; description: string };

export const P2_MARK_DRAFTS: Record<string, Feature[]> = {
  // ---- Gadoids ----
  "Pollachius virens": [
    {
      label: "Straight lateral line",
      description:
        "The pale line down the flank is nearly straight, with no sharp upward kink over the pectoral fin (that kink is pollack's tell).",
    },
    {
      label: "Level jaw",
      description:
        "Upper and lower jaws are about equal (pollack's lower jaw juts out). Barbel tiny or absent.",
    },
    {
      label: "Dark greenish back",
      description:
        "A dark green-brown back over silvery sides, schooling. Also called coalfish or coley.",
    },
  ],
  "Gadus morhua": [
    {
      label: "Long chin barbel",
      description:
        "A long single whisker under the chin, distinctly longer than bib's; the most reliable cod feature.",
    },
    {
      label: "Pale lateral line",
      description:
        "A distinct off-white stripe curves along the flank, easiest to see against the mottled back. No sharp kink.",
    },
    {
      label: "Mottled olive-brown back",
      description:
        "Peppered, mottled camouflage on a green-brown base; cleaner-coloured pollack and saithe lack this speckling.",
    },
  ],
  "Merlangius merlangus": [
    {
      label: "Dark blotch at the pectoral base",
      description:
        "A small dark spot at the upper base of each pectoral fin, the whiting's single most reliable tell against the other small gadoids.",
    },
    {
      label: "No chin barbel",
      description:
        "No whisker under the chin (or a tiny stub at most), unlike cod and bib; the upper jaw is slightly the longer.",
    },
    {
      label: "Slim sandy-grey gadoid, three dorsals",
      description:
        "A slim sandy-grey body with three separate dorsal fins, shoaling near the bottom over sand and mud.",
    },
  ],

  // ---- Wrasses ----
  "Labrus bergylta": [
    {
      label: "Thick fleshy lips",
      description:
        "Big, rubbery lips for picking shellfish off the rock, a wrasse hallmark, strongest in the chunky ballan.",
    },
    {
      label: "Single long dorsal fin",
      description:
        "One continuous dorsal fin runs almost the whole back (spiny at the front, soft behind), not split like a bass or gadoid.",
    },
    {
      label: "Stout mottled body",
      description:
        "A deep, robust green-to-brown body, often pale-spotted and highly variable. Our largest wrasse.",
    },
  ],
  "Symphodus melops": [
    {
      label: "Blue-green lines on the face",
      description:
        "A maze of blue-green wavy lines over the cheek and gill cover, vivid on breeding males.",
    },
    {
      label: "Dark spot on the tail base",
      description:
        "A small dark spot in the centre of the tail base, present in both sexes; the most reliable corkwing tell.",
    },
    {
      label: "Comma behind the eye",
      description: "A short dark comma-shaped mark just behind the eye (clearest on males).",
    },
  ],
  "Ctenolabrus rupestris": [
    {
      label: "Dark spot on upper tail base",
      description:
        "A bold black spot at the TOP of the tail base, the goldsinny's signature mark.",
    },
    {
      label: "Dark spot at front of dorsal",
      description:
        "A second dark blotch at the very front of the dorsal fin. The two black spots together clinch it.",
    },
    {
      label: "Small reddish-brown body",
      description:
        "Our smallest common wrasse (to ~15 cm), slender and reddish-brown, hugging rocky crevices.",
    },
  ],

  // ---- Gobies / sculpin ----
  "Gobiusculus flavescens": [
    {
      label: "Dark spot behind pectoral fin",
      description: "The first of the two namesake dark spots sits just behind the pectoral fin.",
    },
    {
      label: "Dark spot at the tail base",
      description:
        "The second spot sits at the tail base. Two spots plus orange-brown with blue speckles equals two-spotted goby.",
    },
    {
      label: "Hovers in midwater shoals",
      description:
        "Unlike other gobies it does not perch on the bottom; it hovers in loose midwater groups over kelp and weed.",
    },
  ],
  "Taurulus bubalis": [
    {
      label: "Long cheek spine",
      description:
        "A long spine on the cheek (preopercular) reaches back past the gill opening, the tell vs the short-spined sea scorpion.",
    },
    {
      label: "Big spiny head, fan pectorals",
      description:
        "A broad, spiny, knobbly head and large fan-like pectoral fins; a stout, tapering body.",
    },
    {
      label: "Mottled camouflage",
      description:
        "Highly variable blotchy camouflage (green, brown, reddish), sitting motionless among weed and rock.",
    },
  ],

  // ---- Pelagic / schooling ----
  "Scomber scombrus": [
    {
      label: "Wavy green-blue bars",
      description:
        "Bold, wavy, tiger-stripe bars across a metallic blue-green back, the most eye-catching fish in UK waters.",
    },
    {
      label: "Streamlined forked tail",
      description:
        "A deeply forked tail and slim, torpedo-shaped body built for sustained fast swimming.",
    },
    {
      label: "Silver-white belly",
      description:
        "A plain silver-white belly with no bars (the bars only run down the back), sharp contrast with the coloured back.",
    },
  ],
  "Sprattus sprattus": [
    {
      label: "Keel of spiny scutes on belly",
      description:
        "A row of small, sharp scutes runs along the belly keel. Run a finger along it and you feel them. The most reliable sprat tell.",
    },
    {
      label: "No dark spot behind gill",
      description:
        "Unlike the herring, the sprat has no dark spot at the shoulder. A small (to ~15 cm), slim, bright-silver baitfish.",
    },
    {
      label: "Single small dorsal fin",
      description:
        "One short dorsal fin over the middle of the back, not forward of the pelvic fins as in the similar herring.",
    },
  ],
  "Atherina presbyter": [
    {
      label: "Bright silver lateral stripe",
      description:
        "A very bright, solid silver stripe runs the whole length of the flank, the sand smelt's most conspicuous feature.",
    },
    {
      label: "Translucent greenish body",
      description:
        "A slender, semi-transparent body with a greenish tinge above the silver stripe; a small (to ~15 cm), near-surface schooler.",
    },
    {
      label: "Two small dorsal fins",
      description:
        "Two small, separate dorsal fins; the first is tiny and spiny; both are set well back on the body.",
    },
  ],
  "Mullus surmuletus": [
    {
      label: "Two long chin barbels",
      description:
        "A pair of long sensory barbels under the chin, used to probe the sand for food, the red mullet's standout feature.",
    },
    {
      label: "Reddish, with stripes/blotches",
      description:
        "Pink-red flanks marked with reddish-brown stripes and blotches; can flush brighter red. A steeply-sloped forehead.",
    },
    {
      label: "Two separate dorsal fins",
      description:
        "Two well-separated dorsal fins on a deep-bellied body that grubs along sandy and gravelly bottoms.",
    },
  ],

  // ---- Flatfish ----
  "Pleuronectes platessa": [
    {
      label: "Bright orange spots",
      description:
        "Scattered bright orange-red spots over a smooth brown upper side, the plaice's signature, separating it from dab and flounder.",
    },
    {
      label: "Both eyes on one side",
      description:
        "A flatfish: both eyes sit on the right (upper) side. The underside it lies on is plain white.",
    },
    {
      label: "Bony ridge behind eyes",
      description: "A short row of 4-7 bony knobs runs from behind the eyes; smooth skin otherwise.",
    },
  ],
  // Newly authored (no prior seed draft), grounded in fieldNote + UK guides.
  "Limanda limanda": [
    {
      label: "Curved lateral line over pectoral",
      description:
        "A distinct concave arch in the lateral line just above the pectoral fin, the dab's single most reliable tell against plaice and flounder.",
    },
    {
      label: "Rough sandpaper skin",
      description:
        "The scales feel rough and sandpapery to the touch; the only common UK flatfish with this texture.",
    },
    {
      label: "Plain sandy-brown, right-eyed",
      description:
        "Both eyes on the right (upper) side; a plain sandy-brown back with no bright orange spots, plainer than plaice.",
    },
  ],
  "Platichthys flesus": [
    {
      label: "Bony tubercles along the fin bases",
      description:
        "A rough run of small bony knobs along the bases of the dorsal and anal fins and the lateral line, rough to the touch unlike the smooth plaice.",
    },
    {
      label: "Pale, scattered spots",
      description:
        "Any orange spots are pale and scattered, never the vivid, well-defined orange of a plaice.",
    },
    {
      label: "Dull brown estuary flatfish",
      description:
        "A dull greenish-brown right-eyed flatfish; the one UK flatfish that runs up into brackish estuaries and tidal rivers.",
    },
  ],

  // ---- Dragonet ----
  "Callionymus maculatus": [
    {
      label: "Flat-headed, sits on sand",
      description:
        "A small flat-headed dragonet that lies pressed to sandy-muddy bottoms with eyes set high on top of the head. Smaller than the common dragonet.",
    },
    {
      label: "Cream-and-brown spotty camouflage",
      description:
        "Finely spotted and reticulated (net-patterned) in cream and brown for camouflage on sand, hence the spotted dragonet.",
    },
    {
      label: "Modest first dorsal (male)",
      description:
        "The male raises a first dorsal fin in display, but it is lower and less filamentous than the tall sail of the common dragonet.",
    },
  ],

  // ---- Echinoderms: sea urchins (added 2 Jul 2026, `starfish` shape class,
  // `round-spiny`/`heart-shaped` armForm) ----
  "Echinus esculentus": [
    {
      label: "Large pink-red spiny ball",
      description:
        "A large, robust ball covered in short, dense spines, pinkish-red to purple-red. By far the biggest of the UK's regular urchins.",
    },
    {
      label: "Five-part radial pattern",
      description:
        "Faint pale bands run in five double rows from top to bottom of the test (the ambulacral grooves), visible where spines are thin.",
    },
    {
      label: "On rock and kelp forest",
      description:
        "Grazes exposed rock and kelp holdfasts on the lower shore and shallow subtidal, rather than tucked in a hollow.",
    },
  ],
  "Psammechinus miliaris": [
    {
      label: "Green test, purple spine tips",
      description:
        "A small, bright green ball with each spine tipped violet-purple, the giveaway against the other round urchins.",
    },
    {
      label: "Camouflage debris on spines",
      description:
        "Often carries bits of shell, gravel or weed wedged between the spines for cover, more than the other UK urchins do.",
    },
    {
      label: "Small size, rock pools and kelp",
      description:
        "The smallest common UK urchin, typically under 4cm, in shallow rock pools and kelp holdfasts.",
    },
  ],
  "Paracentrotus lividus": [
    {
      label: "Deep purple-brown, longer spines",
      description:
        "A dark purple-brown (sometimes greenish) ball with noticeably longer, more slender spines than the green sea urchin.",
    },
    {
      label: "Sits in an excavated rock hollow",
      description:
        "Often found bedded into a self-excavated pit in soft rock, only the spine tips showing above the rim.",
    },
    {
      label: "South-western rocky shores",
      description:
        "A specialist of exposed rocky shores in the milder south-west, less widespread around the UK than the common or green urchin.",
    },
  ],
  "Echinocardium cordatum": [
    {
      label: "Oval, heart-shaped test",
      description:
        "An oval to heart-shaped test with a shallow notch at the front end, quite unlike the round ball of a regular urchin.",
    },
    {
      label: "Fine fur of short spines",
      description:
        "Covered in a dense, fine fur of short yellowish spines rather than the long defensive spines of Echinus or Paracentrotus.",
    },
    {
      label: "Burrows in sand; often just the pale test",
      description:
        "Lives buried in sandy sediment, so it is most often seen on camera as the pale, fragile empty test lying on the seabed rather than the live animal.",
    },
  ],

  // ---- Wildlife: diving seabirds + seals (added 2 Jul 2026, new `wildlife`
  // shape class, `diving-bird`/`pinniped` wildlifeForm) ----
  "Phalacrocorax aristotelis": [
    {
      label: "All-dark glossy plumage",
      description:
        "Uniformly dark black-green with an oily sheen, no white patches anywhere, unlike the cormorant.",
    },
    {
      label: "Slim hooked bill, steep forehead",
      description:
        "A slim, sharply hooked bill and a steep forehead give a slightly quiffed profile; breeding birds grow a small forward-curling crest.",
    },
    {
      label: "Fast, agile underwater swimmer",
      description:
        "Swims low in the water with just the head and neck showing, then dives fast and directly after fish, often solitary.",
    },
  ],
  "Phalacrocorax carbo": [
    {
      label: "Yellow-orange bare face patch",
      description:
        "A patch of bare yellow-orange skin at the base of the bill and around the eye, the single most reliable tell against the shag.",
    },
    {
      label: "White cheek and throat patch",
      description:
        "A white patch on the cheek and throat (more extensive and whiter than any shag marking); breeding adults also show a white thigh patch.",
    },
    {
      label: "Wings-open drying posture",
      description:
        "Often perches upright with both wings held open to dry after diving, a habit distinctive among UK waterbirds.",
    },
  ],
  "Uria aalge": [
    {
      label: "Long, thin, dagger-like bill",
      description:
        "A slender, pointed bill much longer and thinner than a razorbill's blunt one, held level.",
    },
    {
      label: "Dark brown (not black) upperparts",
      description:
        "Chocolate-brown rather than glossy black upperparts, with a clean white belly and foreneck.",
    },
    {
      label: "Upright, small-penguin posture",
      description:
        "Stands and swims in an upright, small-penguin-like posture, usually in dense rafts or colonies rather than alone.",
    },
  ],
  "Alca torda": [
    {
      label: "Thick, blunt bill with a white stripe",
      description:
        "A deep, laterally flattened, blunt-tipped bill crossed by a bold white vertical stripe, the razorbill's clearest tell.",
    },
    {
      label: "Glossy black (not brown) upperparts",
      description:
        "Glossy jet-black upperparts (versus the guillemot's chocolate-brown), with a fine white line running from the bill to the eye.",
    },
    {
      label: "Stockier, blockier head than a guillemot",
      description:
        "A more robust, blocky head and thicker neck than the slimmer-headed guillemot it often rafts alongside.",
    },
  ],
  "Halichoerus grypus": [
    {
      label: "Long, straight \"Roman nose\" profile",
      description:
        "A long, straight, sloping muzzle in profile, quite unlike the harbour seal's short rounded face.",
    },
    {
      label: "Widely-spaced, parallel nostrils",
      description:
        "Nostril slits sit parallel and well apart, rather than meeting in a V at the bottom.",
    },
    {
      label: "Bulky body, blotchy coat",
      description:
        "A noticeably larger, bulkier body than a harbour seal, with an irregular blotchy (not evenly spotted) coat pattern.",
    },
  ],
  "Phoca vitulina": [
    {
      label: "Short, rounded \"dog-like\" head",
      description:
        "A short, rounded head with a steep forehead, giving a dog-like profile quite unlike the grey seal's long muzzle.",
    },
    {
      label: "V-shaped nostrils",
      description:
        "Nostril slits meet in a V shape at the bottom, close together (versus the grey seal's parallel, widely-spaced slits).",
    },
    {
      label: "Small, evenly-spotted coat",
      description:
        "A smaller, daintier body than a grey seal, with small, fairly regular spots evenly covering the coat.",
    },
  ],
};
