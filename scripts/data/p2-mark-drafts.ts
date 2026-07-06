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

  // ---- Sea urchins (regular) ----
  // NB: a round urchin has no separable parts, so 3 rings collapse to
  // concentric circles. Use 2 marks at different scales/positions: one on the
  // central body/test, one on a spine zone at the rim.
  "Echinus esculentus": [
    {
      label: "Domed globular test",
      description:
        "The large rounded body forms a tall dome, up to 15 cm across; this is the biggest and roundest UK urchin, reddish-pink in colour.",
    },
    {
      label: "Short blunt spines",
      description:
        "The spines around the rim are short and stubby, a neat pincushion rather than the long spikes of the purple urchin.",
    },
  ],
  "Psammechinus miliaris": [
    {
      label: "Small green test",
      description:
        "The compact central body is green-tinged and usually under 5 cm, far smaller than the edible urchin.",
    },
    {
      label: "Violet-tipped spines",
      description:
        "The short spines around the edge are tipped with purple or violet, the feature that names the green sea urchin.",
    },
  ],
  "Paracentrotus lividus": [
    {
      label: "Long pointed spines",
      description:
        "Long, strong, sharply pointed spines radiate outward, much longer relative to the body than the edible or green urchin's short spines.",
    },
    {
      label: "Dark purple test",
      description:
        "The central body is dark purple, brown or olive-green; often wedged in a self-excavated rock hollow.",
    },
  ],

  // ---- Sea urchins (irregular / heart) ----
  "Echinocardium cordatum": [
    {
      label: "Heart-shaped mound",
      description:
        "Not a ball but a domed heart or egg shape half-buried in clean sand, quite unlike the round regular urchins.",
    },
    {
      label: "Fine fur-like spines",
      description:
        "The surface is covered in short, dense, backward-swept yellowish spines that look more like fur or felt than spikes.",
    },
  ],
  "Spatangus purpureus": [
    {
      label: "Large purple heart test",
      description:
        "A big heart-shaped urchin (up to 12 cm) flushed purple, larger and more strongly coloured than the sea potato.",
    },
    {
      label: "Sparse, flattened spines",
      description:
        "Spines are shorter and sparser than the sea potato's dense fur, so more of the purple test shows through.",
    },
    {
      label: "Front apical groove",
      description:
        "A clear groove runs forward over the top of the heart shape toward the mouth end.",
    },
  ],

  // ---- Seabirds ----
  "Phalacrocorax aristotelis": [
    {
      label: "Slim bill, steep forehead",
      description:
        "A slender hooked bill meeting a steep, rounded forehead; daintier-headed than the heavy-billed cormorant.",
    },
    {
      label: "Upright forward-curling crest",
      description:
        "In breeding plumage a short quiff-like crest curls forward off the forehead, the shag's signature.",
    },
    {
      label: "Glossy bottle-green plumage + yellow gape",
      description:
        "All-dark plumage with an oily green sheen and a small yellow patch of skin at the base of the bill; no white on the face or thighs.",
    },
  ],
  "Phalacrocorax carbo": [
    {
      label: "Heavy hooked bill, white face patch",
      description:
        "A thick, powerful hooked bill set off by bare yellow skin and a white chin-and-cheek patch, bigger-headed than the shag.",
    },
    {
      label: "White thigh patch (breeding)",
      description:
        "A bold white patch on the flank/thigh in breeding plumage, diagnostic against the shag which never shows it.",
    },
    {
      label: "Bulky black body",
      description:
        "A large, heavy, bronze-black waterbird that swims low and stands upright with wings spread to dry.",
    },
  ],
  "Somateria mollissima": [
    {
      label: "Wedge-shaped bill and head",
      description:
        "At the front of the head, feathering runs far down the bill in a long sloping wedge, giving a flat 'Roman' profile with no forehead step and a black crown cap.",
    },
    {
      label: "Black-and-white body",
      description:
        "The male's bulky body is clean white above and black below, unlike any other UK sea duck; it rides low in coastal water.",
    },
  ],

  // ---- Seals ----
  "Halichoerus grypus": [
    {
      label: "Long straight 'Roman nose' snout",
      description:
        "A long, straight, heavy muzzle with the forehead sloping smoothly into the nose (no dip), the key feature versus the harbour seal.",
    },
    {
      label: "Wide, near-parallel nostrils",
      description:
        "Nostrils are large and set well apart, running almost parallel rather than meeting in a V.",
    },
    {
      label: "Blotchy grey coat",
      description:
        "A grey coat marked with bold irregular dark blotches; a big, heavy seal (bulls up to 2.5 m).",
    },
  ],
  "Phoca vitulina": [
    {
      label: "Short dished 'puppy' face",
      description:
        "A small rounded head with a short snout and a clear concave dip between forehead and nose, a dog- or cat-like face unlike the grey seal's long straight muzzle.",
    },
    {
      label: "Densely spotted coat",
      description:
        "The body is peppered all over with fine dark spots and rings on a grey-to-tan ground; a smaller, rounder seal than the grey.",
    },
  ],
};
