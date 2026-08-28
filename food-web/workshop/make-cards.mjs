// Build the 40 workshop species cards (front + back) as a colour, PEBL-branded
// contact sheet for review — grouped by table, one page-pair per deck.
// Real photography (print-safe licence only) from the live SpeciesImage cache
// via card-photos.json (run fetch-card-photos.mjs first), real scannable QR
// codes, and the real PEBL logo. I EAT / EATS ME are hand-written per species
// (see DIET below) from the full 72-species food web plus each species' own
// catalogue fieldNote — general biology, not restricted to the 8 cards on that
// species' own workshop table (that restriction was a game-table artifact, not
// a scientific fact, so it does not belong on a species-reference card).
//   node food-web/workshop/make-cards.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import QRCode from 'qrcode';
// farmOf() is deliberately NOT imported any more: the cards no longer print a
// farm-status verdict. See the note where FARMBADGE used to be defined.
import { SPECIES, FORMS } from '../build-foodweb.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SIL = join(HERE, '..', '..', 'public', 'silhouettes');
const OUT = join(HERE, 'cards.html');
const CAT = JSON.parse(readFileSync(join(HERE, '..', '..', 'src', 'data', 'species-traits.json'), 'utf8'));
const PHOTOS = existsSync(join(HERE, 'card-photos.json')) ? JSON.parse(readFileSync(join(HERE, 'card-photos.json'), 'utf8')) : {};
// real PEBL wordmark, dark-navy colourway — embedded byte-for-byte as a data
// URI so the exact brand artwork prints, not a hand-reconstructed approximation
const LOGO_SVG = readFileSync(join(HERE, '..', '..', 'public', 'branding', 'PEBL Logo-1.svg'));
const LOGO_URI = `data:image/svg+xml;base64,${LOGO_SVG.toString('base64')}`;

const byName = Object.fromEntries(SPECIES.map(s => [s.name, s]));
const byCommon = new Map(Object.entries(CAT).map(([sci, v]) => [v.commonName, { sci, ...v }]));

// The CARD_OVERRIDE shim that used to live here (pinning Octopus vulgaris for a
// workshop audience while the catalogue still only had Eledone cirrhosa) is gone:
// the live catalogue now carries BOTH octopuses as real entries, and the food web
// resolves farmOf('Common Octopus') on its own. Keeping the shim would have frozen
// a stale habitat (['rocky-crevice'] only) over the catalogue's real one, and would
// have hidden a genuine miss if either entry were ever removed. Verified 26 Aug 2026.

// Site root for the card QR codes. Every card deep-links to its own species guide
// page, so the app reads as "this card, extrapolated" -- see QR_TARGET below.
const SITE = 'https://fish-spotter.vercel.app';
// Must match speciesSlug() in src/lib/species-slug.ts exactly, or the QR 404s.
// That route resolves the slug from the SCIENTIFIC name via resolveSpeciesSlug(),
// so pass e.sci here and never the common name.
const speciesSlug = s => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const QR_TARGET = sci => `${SITE}/species/${speciesSlug(sci)}`;

const TIER = { 2: '#63AEB5', 3: '#2E8C9E', 4: '#2A6394', 5: '#26324E' };
const TIERLABEL = { 2: 'Grazer / filter feeder', 3: 'Planktivore / invertivore', 4: 'Predator', 5: 'Apex predator' };

// The FARMBADGE block that used to live here (a ●/◑/○/✦ glyph plus FARM-BUILT /
// BOOSTED / HERE ANYWAY / BETTER WITHOUT and a hint like "gone without the farm")
// has been REMOVED, deliberately. Two independent reasons, Aug 2026:
//
//   1. It asserted the answer. A reviewer challenged the FARM-BUILT premise on the
//      grounds that a mussel or seaweed line is rope and buoys, not rock, so it is
//      not obvious a limpet or top shell would genuinely vanish without it. Printing
//      "gone without the farm" on the card states as fact the very thing we cannot
//      demonstrate, and states it in the participant's hand.
//   2. The revised workshop has no reveal step for it to serve. The old run-of-show
//      called "turn over the filled circle" at minute 24, which is what put the glyph
//      on the card in the first place. In the revised design the participants build
//      the natural web first, then flip a clear farm-infrastructure overlay onto it
//      and draw the new links THEMSELVES. A printed verdict would let the room
//      reverse-engineer the answer instead of reasoning to it, which is the entire
//      point of the exercise.
//
// The created/enhanced/anyway/harmed classification is NOT gone: it still lives in
// build-foodweb.mjs and still drives the facilitator guide's master-solution sheets,
// where it belongs. It is a facilitator's reference, not a claim on a handout.

// Same 5 decks as make-decks.mjs (kept independent/literal so this script has
// no import-order coupling — cross-checked against it by the report below).
//
// Deck names are deliberately NEUTRAL ("Group 1", not "The kelp canopy"). Reviewer
// feedback, Aug 2026: the zone names read as an ecological claim about where each
// animal lives, which is more than the deck is doing -- the decks are a dealing
// convenience that guarantees every table can build a chain, not a habitat survey.
// The species' actual habitat is on the card's own I LIVE line and on its guide page.
const DECKS = [
  { table: 1, title: 'Group 1', cards: ['Common Limpet','Edible sea urchin','Painted Top Shell','Ballan wrasse','Two-spotted goby','Spider Crab','Thick-lipped mullet','Great cormorant'] },
  { table: 2, title: 'Group 2', cards: ['Dog Whelk','Velvet Swimming Crab','Spiny Starfish','Common Starfish','Common Brittlestar','Shore Crab','Edible Crab','Common eider'] },
  { table: 3, title: 'Group 3', cards: ['Sprat','Sand smelt','Fifteen-spined stickleback','Poor cod','Bib','Pollack','Atlantic cod','European shag'] },
  { table: 4, title: 'Group 4', cards: ['Hermit Crab','Butterfish','Shanny','Rock goby','Common Octopus','Conger eel','Lesser-spotted catshark','Grey seal'] },
  { table: 5, title: 'Group 5', cards: ['Sea potato','Purple heart urchin','Dragonet','Sand goby','Long-spined sea scorpion','Plaice','Flounder','Harbour seal'] },
];

// Plain, informative one-liners written from each species' own catalogue
// fieldNote (never invented traits) — a factual descriptor, not a tagline.
const NICK = {
  'Common Limpet': 'Grazes algae off bare rock, always returning to the same spot', 'Edible sea urchin': "Britain's largest sea urchin, grazing kelp and rock algae",
  'Painted Top Shell': 'A glossy, cone-shaped shell marbled in pink and white', 'Ballan wrasse': 'A stocky wrasse that crushes shellfish with strong teeth',
  'Two-spotted goby': 'Hovers in loose midwater groups near kelp, unlike most gobies', 'Spider Crab': 'Decorates its shell with seaweed and hydroids for camouflage',
  'Thick-lipped mullet': 'A silver mullet that cruises near the surface in schools', 'Great cormorant': 'Dives for fish, then dries its wings held open on rocks',
  'Dog Whelk': 'Drills through mussel and barnacle shells to feed', 'Velvet Swimming Crab': 'A red-eyed crab with paddle-shaped back legs for swimming',
  'Spiny Starfish': "Britain's largest starfish, with spines ringed in blue", 'Common Starfish': 'The familiar orange starfish, often found near mussel beds',
  'Common Brittlestar': 'Carpets the seabed in dense beds of thin, fragile arms', 'Shore Crab': "Britain's commonest crab, found on almost every shore",
  'Edible Crab': 'A broad crab with a crimped, pie-crust shell edge', 'Common eider': "Britain's heaviest duck, diving for mussels near the farm",
  'Sprat': 'A small shoaling baitfish and prey for almost everything else', 'Sand smelt': 'A slender, silver-striped fish that shoals near the surface',
  'Fifteen-spined stickleback': 'Hovers almost motionless, camouflaged among kelp fronds', 'Poor cod': 'A small cod relative with one chin barbel and large eyes',
  'Bib': 'A banded cod relative that shoals densely near wrecks', 'Pollack': 'A mid-water hunter with a sharply kinked lateral line',
  'Atlantic cod': 'A heavy-bodied cod with three dorsal fins and a chin barbel', 'European shag': 'A dark diving bird that can stay underwater for 20-40 seconds',
  'Hermit Crab': 'Lives inside a borrowed whelk or periwinkle shell', 'Butterfish': 'A slippery, ribbon-like fish with dark eye-spots along its fin',
  'Shanny': 'A tubby blenny that darts in and out of rockpool crevices', 'Rock goby': 'A goby with fused pelvic fins that form a sucker',
  'Common Octopus': 'A muscular octopus with two rows of suckers on each arm and a strong, shell-opening beak', 'Conger eel': 'A large eel, usually seen only as a head peering from a crevice',
  'Lesser-spotted catshark': 'A small, spotted shark that curls up on the seabed', 'Grey seal': "Britain's larger seal, with a long, straight 'Roman nose'",
  'Sea potato': 'An urchin that lives buried in sand and is rarely seen alive', 'Purple heart urchin': 'A larger heart urchin that ploughs shallow trails through sand',
  'Dragonet': 'A sand-dwelling fish; males display a tall dorsal fin', 'Sand goby': 'A pale, near-transparent goby that blends into sand',
  'Long-spined sea scorpion': 'An armoured ambush predator camouflaged against rock', 'Plaice': 'A flatfish with bright orange spots scattered across its back',
  'Flounder': 'A flatfish that tolerates fresh water and enters rivers', 'Harbour seal': 'Smaller than the grey seal, often hauled out in a curved pose',
};

const HAB_LABEL = { 'kelp': 'the kelp canopy', 'rocky-crevice': 'rocky crevices', 'sandy-bottom': 'the open sand',
  'midwater': 'open midwater', 'near-surface': 'near the surface', 'open-water': 'the open water' };
const habitatText = e => (e.habitat || []).map(h => HAB_LABEL[h] || h).join(' and ') || 'the farm';

// The HAB_LABEL vocabulary above was written for animals that live IN the water, so
// generating an I LIVE line from the catalogue's habitat tags makes an air-breather
// read like a fish: the grey seal came out as "rocky crevices and near the surface",
// and the cormorant as "near the surface and the open water and rocky crevices".
// Reviewer comment (Aug 2026) flagged this on the cormorant; auditing the rest found
// the same fault on all five birds and seals. These get a hand-written line, exactly
// as NICK and DIET already are, rather than a fix to the shared tag vocabulary --
// the tags themselves are right for the 35 underwater species that use them, and
// "where a seal hauls out" is not a thing the tag set is trying to express.
const HABITAT_OVERRIDE = {
  'Great cormorant': 'Coastal cliffs and rocky shores, diving inshore to hunt',
  'European shag':   'Sea cliffs and rocky ledges, diving close inshore',
  'Common eider':    'Sheltered rocky coasts, diving for mussels',
  'Grey seal':       'Rocky shores and skerries, hauled out between dives',
  'Harbour seal':    'Sandbanks and sheltered shores, hauled out between dives',
};

// General, species-level diet, written from (a) the full 72-species food web
// (verified 0 errors by food-web/verify.mjs) and (b) each species' own
// catalogue fieldNote — not restricted to the 8 species dealt to its table,
// which is a workshop-table artifact, not a fact about the animal. Where the
// full web lists many prey/predators (e.g. cod, seals, cormorant) this is
// condensed to a representative, accurate summary rather than a long dump.
const DIET = {
  'Common Limpet': { eat: 'Algae grazed off bare rock', by: 'Wrasse, including the ballan wrasse' },
  'Edible sea urchin': { eat: 'Kelp and other seaweed', by: 'Wrasse' },
  'Painted Top Shell': { eat: 'Kelp and other seaweed', by: 'Wrasse' },
  'Ballan wrasse': { eat: 'Limpets, top shells, urchins, mussels and small crabs, crushed with strong pharyngeal teeth', by: 'Grey seals and cormorants' },
  'Two-spotted goby': { eat: 'Plankton', by: 'Sea bass, pollack and shags' },
  'Spider Crab': { eat: 'Kelp and seabed detritus', by: 'Wrasse, cuttlefish, octopus, cod and eider' },
  // Reviewer, Aug 2026: "algae" alone undersells this fish. Adult Chelon labrosus
  // takes benthic diatoms, epiphytic algae, detritus AND small invertebrates, with
  // juveniles on zooplankton. Anjali's facilitator script independently says the
  // mullet "will happily eat tiny animals like invertebrates", so the old line also
  // contradicted the script the room is being read from.
  'Thick-lipped mullet': { eat: 'Diatoms, algae and detritus sieved from the sediment, plus small invertebrates', by: 'Cormorants, grey seals and sea bass' },
  // Reviewer, Aug 2026: "especially wrasse and mullet" was unsourced specificity.
  // UK diet studies show the great cormorant is an opportunist that concentrates on
  // whatever is locally abundant, and takes mostly small fish. That generalist habit
  // is the honest claim, and it is also the more interesting one.
  'Great cormorant': { eat: 'A wide range of inshore fish, mostly small ones, whatever is locally common', by: 'No natural predators as an adult' },
  'Dog Whelk': { eat: 'Mussels and barnacles, drilled through with a rasping tongue', by: 'Wrasse and eider' },
  'Velvet Swimming Crab': { eat: 'Mussels and other shellfish', by: 'Octopus, cod and conger eel' },
  'Spiny Starfish': { eat: 'Mussels and other bivalves', by: 'No common predator, well defended by spines' },
  'Common Starfish': { eat: 'Mussels and brittlestars, prised open and digested externally', by: 'No common predator' },
  'Common Brittlestar': { eat: 'Plankton and fine organic detritus', by: 'Flatfish, gurnards, dragonets and wrasse' },
  'Shore Crab': { eat: 'Seabed detritus, carrion and smaller invertebrates', by: 'Catshark, gurnards, cuttlefish, octopus, cod, conger eel and eider' },
  'Edible Crab': { eat: 'Mussels, seabed detritus and smaller crabs', by: 'Octopus, conger eel and grey seals' },
  'Common eider': { eat: 'Mussels, crabs, whelks and urchins, swallowed whole', by: 'No natural predators as an adult' },
  'Sprat': { eat: 'Plankton', by: 'Almost every larger predator here, from bass and cod to squid, mackerel and seabirds' },
  'Sand smelt': { eat: 'Plankton', by: 'Sea bass, pollack, seals and diving birds' },
  'Fifteen-spined stickleback': { eat: 'Plankton', by: 'Pollack, sea scorpions and shags' },
  'Poor cod': { eat: 'Plankton and small crabs', by: 'Larger gadoids, conger eel and grey seals' },
  'Bib': { eat: 'Sprat and small crabs', by: 'Atlantic cod, conger eel and grey seals' },
  'Pollack': { eat: 'Sprat, sandeel-like fish and gobies, hunted mid-water', by: 'Grey and harbour seals, shags' },
  'Atlantic cod': { eat: 'A very broad diet: small fish, crabs, cuttlefish and gurnards', by: 'Grey seals' },
  'European shag': { eat: 'Sprat, sand smelt, gobies and sticklebacks, chased underwater', by: 'No natural predators as an adult' },
  'Hermit Crab': { eat: 'Seabed detritus and scraps, scavenged rather than hunted', by: 'Catshark, gurnards, cuttlefish and octopus' },
  'Butterfish': { eat: 'Small invertebrates picked from crevices', by: 'Conger eel and shags' },
  'Shanny': { eat: 'Small invertebrates and algae from rockpools', by: 'Conger eel' },
  'Rock goby': { eat: 'Plankton and small invertebrates', by: 'Atlantic cod, conger eel, cormorants and shags' },
  'Common Octopus': { eat: 'Crabs, mussels and other shellfish, opened with a strong beak', by: 'Conger eel and grey seals' },
  'Conger eel': { eat: 'Crabs, small fish, blennies and other cephalopods, ambushed from a crevice', by: 'Grey seals' },
  'Lesser-spotted catshark': { eat: 'Brittlestars, hermit crabs, sea potatoes and small fish', by: 'Conger eel and grey seals' },
  'Grey seal': { eat: 'A very broad diet of fish, crabs and cephalopods', by: 'No natural predators as an adult' },
  'Sea potato': { eat: 'Organic matter sieved from clean sand while buried', by: 'Plaice, flounder and catshark' },
  'Purple heart urchin': { eat: 'Organic matter ploughed from sand just below the surface', by: 'Plaice' },
  'Dragonet': { eat: 'Small worms, crustaceans and brittlestars picked off the sand', by: 'Atlantic cod and catshark' },
  'Sand goby': { eat: 'Plankton and small invertebrates', by: 'Cod, sea scorpions, shags, gurnards and sea bass' },
  'Long-spined sea scorpion': { eat: 'Small fish, ambushed while camouflaged against rock', by: 'Conger eel' },
  'Plaice': { eat: 'Brittlestars and burrowing urchins', by: 'Grey seals and cormorants' },
  'Flounder': { eat: 'Brittlestars and sea potatoes', by: 'Harbour seals and cormorants' },
  'Harbour seal': { eat: 'Sea bass, squid, pollack, sand smelt and flatfish', by: 'No natural predators as an adult' },
};

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const idOf = s => s.replace(/[^a-z0-9]+/gi, '_');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// silhouette symbols for the licence-blocked species (rendered instead of a photo)
const FORMS_NEEDED = new Set(DECKS.flatMap(d => d.cards).map(n => byName[n]?.form).filter(Boolean));
function symbolFor(form) {
  const raw = readFileSync(join(SIL, FORMS[form]), 'utf8');
  const vb = (raw.match(/viewBox="([^"]+)"/) || [])[1] || '0 0 64 64';
  const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();
  return `<symbol id="f-${form}" viewBox="${vb}"><g fill="currentColor">${inner}</g></symbol>`;
}
const SPRITE = [...FORMS_NEEDED].map(symbolFor).join('\n');

async function qr(url) {
  return QRCode.toDataURL(url, { margin: 0, width: 240, color: { dark: '#17252A', light: '#00000000' } });
}

const cardsHtml = [];
const report = { photo: [], silhouette: [], dietMissing: [] };

for (const deck of DECKS) {
  for (const name of deck.cards) {
    const sp = byName[name];
    const e = byCommon.get(name);
    if (!sp || !e) { console.warn('MISSING catalogue entry for', name); continue; }
    const diet = DIET[name];
    if (!diet) report.dietMissing.push(name);
    const tierColor = TIER[sp.tier];
    const photo = PHOTOS[name];
    photo ? report.photo.push(name) : report.silhouette.push(name);
    const qrUri = await qr(QR_TARGET(e.sci));

    const media = photo
      ? `<img class="photo" src="${esc(photo.url)}" alt="${esc(name)}">`
      : `<div class="photo silhouette" style="color:${tierColor}"><svg viewBox="0 0 64 64"><use href="#f-${sp.form}"/></svg></div>`;
    const creditLine = photo
      ? `${esc(photo.attribution)} &middot; ${esc(photo.license.toUpperCase())} &middot; via ${esc(photo.source)}`
      : `PEBL / FishSpotter silhouette &mdash; no print-safe photo cached yet`;

    cardsHtml.push(`
    <div class="pair" data-id="${idOf(name)}">
      <div class="card front">
        <div class="tier-stripe" style="background:${tierColor}"></div>
        ${media}
        <div class="namebox">
          <p class="name">${esc(name)}</p>
          <p class="sci">${esc(e.sci)}</p>
          <p class="nick">${esc(NICK[name] || '')}</p>
        </div>
        <p class="credit">${creditLine}</p>
        <img class="pebl-logo" src="${LOGO_URI}" alt="PEBL">
      </div>
      <div class="card back">
        <div class="tier-stripe" style="background:${tierColor}"></div>
        <div class="tierline"><span class="tierchip" style="background:${tierColor}">T${sp.tier}</span> ${TIERLABEL[sp.tier]}</div>
        <div class="field"><b>I LIVE</b><span>${esc(HABITAT_OVERRIDE[name] || cap(habitatText(e)))}</span></div>
        <div class="field"><b>I EAT</b><span>${esc(diet?.eat || '—')}</span></div>
        <div class="field"><b>EATS ME</b><span>${esc(diet?.by || '—')}</span></div>
        <div class="qrrow">
          <img class="qr" src="${qrUri}">
          <div class="qrtext"><b>Scan for the full story.</b> Depth, range, what eats it, and the references behind every line on this card.</div>
        </div>
        <div class="cardfoot">
          <img class="pebl-logo small" src="${LOGO_URI}" alt="PEBL">
          <span>pebl-cic.co.uk</span>
        </div>
      </div>
    </div>`);
  }
}
if (report.dietMissing.length) console.warn('!! NO DIET ENTRY for:', report.dietMissing.join(', '));

const css = `
:root{ --navy:#17252A; --teal:#3AAFA9; --dteal:#2B7A78; --lteal:#DEF2F1; --white:#fff; --soft:#4d6b72; --hair:#cfe0e0; }
*{box-sizing:border-box}
@page{ size:A4; margin:10mm; }
body{margin:0;font-family:Helvetica,Arial,sans-serif;color:var(--navy);-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:9pt}
h1{font-size:17pt;margin:0 0 2pt;letter-spacing:-.3pt}
.eyebrow{font-size:8pt;letter-spacing:1.4pt;text-transform:uppercase;color:var(--dteal);font-weight:bold;margin:0 0 4pt}
.subhead{font-size:9pt;color:var(--soft);margin:0 0 10pt;max-width:170mm}
.deckpage{page-break-after:always}
.deckpage:last-child{page-break-after:auto}
.deckhdr{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1.5pt solid var(--navy);padding-bottom:4pt;margin-bottom:9pt}
.deckhdr .t{font-size:13pt;font-weight:bold}
.deckhdr .n{font-size:8.5pt;color:var(--soft)}
.reviewnote{font-size:8.6pt;line-height:1.5;color:var(--soft);max-width:178mm;background:var(--lteal);border-left:3pt solid var(--teal);padding:3mm 4mm;border-radius:2pt}
.reviewnote b{color:var(--navy)}
/* 2 pairs (front+back) per row: 4 x 44mm cards + 2 x 2mm within-pair gaps +
   1 x 4mm column gap = 184mm, inside the 190mm usable width (A4 less 2x10mm
   page margin) — leaves 6mm of slack. Card ratio 44:62 matches true A6 (105:148)
   so this preview is proportionally honest, not just a rough thumbnail. */
.grid{display:grid;grid-template-columns:1fr 1fr;gap:5mm 4mm}
.pair{display:flex;gap:2mm;min-width:0;break-inside:avoid;page-break-inside:avoid}
.card{width:44mm;height:58mm;flex:0 0 44mm;border:0.8pt solid var(--hair);border-radius:2.5mm;position:relative;overflow:hidden;background:#fff;display:flex;flex-direction:column;box-shadow:0 0.4mm 1.2mm rgba(23,37,42,.12)}
.tier-stripe{height:2.2mm;flex:0 0 auto}
/* FRONT */
.card.front .photo{height:24mm;width:100%;object-fit:cover;background:var(--lteal);flex:0 0 auto}
.card.front .photo.silhouette{display:flex;align-items:center;justify-content:center;padding:2.5mm}
.card.front .photo.silhouette svg{width:70%;height:70%}
.namebox{padding:1.8mm 2.2mm 0;min-width:0}
.name{margin:0;font-size:8.6pt;font-weight:bold;line-height:1.1;color:var(--navy);overflow-wrap:break-word}
.sci{margin:0.4mm 0 0;font-size:6.4pt;font-style:italic;color:#9aa7ab;overflow-wrap:break-word}
.nick{margin:1mm 0 0;font-size:6.4pt;color:var(--soft);line-height:1.25}
.credit{margin:auto 2.2mm 1mm;font-size:4.8pt;color:#9aa7ab;line-height:1.15}
.pebl-logo{height:4mm;width:auto;display:block;margin:0 2.2mm 1.6mm auto;opacity:.9}
/* BACK */
.card.back{padding:1.8mm 2.2mm 1.3mm;min-width:0}
.tierline{font-size:6pt;color:var(--soft);display:flex;align-items:center;gap:1.2mm;margin:1.2mm 0 2mm}
.tierchip{color:#fff;font-size:5.4pt;font-weight:bold;border-radius:2pt;padding:0.3mm 1.4mm;flex:0 0 auto}
.field{margin-bottom:2mm;min-width:0}
.field b{display:block;font-size:5pt;letter-spacing:.5pt;color:var(--dteal);text-transform:uppercase;margin-bottom:0.3mm}
.field span{display:block;font-size:6.1pt;line-height:1.3;color:var(--navy);overflow-wrap:break-word}
/* .farmbadge / .fsym / .flab / .fhint removed with the farm-status glyph itself
   (see the note where FARMBADGE used to be defined). The freed vertical space on
   the card back is left to the three content fields rather than reclaimed. */
.qrrow{margin-top:auto;display:flex;align-items:center;gap:1.4mm;border-top:0.5pt solid var(--hair);padding-top:1.2mm;min-width:0}
.qr{width:8mm;height:8mm;flex:0 0 auto}
.qrtext{font-size:4.6pt;line-height:1.2;color:var(--soft);min-width:0}
.qrtext b{color:var(--navy)}
.cardfoot{display:flex;align-items:center;gap:1.2mm;margin-top:1mm}
.cardfoot .pebl-logo{height:3mm;margin:0}
.cardfoot span{font-size:4.4pt;color:#9aa7ab;letter-spacing:.2pt}
`;

const introPage = `
<div class="deckpage">
  <p class="eyebrow">PEBL &middot; FishSpotter &middot; who lives on a seaweed farm</p>
  <h1>Species cards &mdash; review sheet</h1>
  <p class="subhead">Colour, A6 double-sided, one deck per following page (8 cards, grouped by workshop table for printing only). Front: photo, name, one-line description. Back: I live / I eat / eats me as general species biology, a real scannable QR to FishSpotter.</p>
  <p class="reviewnote"><b>For review, not final print.</b> Every photo is a real, print-safe (CC0 / CC-BY / CC-BY-SA) image showing the live animal in water or on natural substrate &mdash; none hand-held or out of habitat &mdash; each checked with Gemini vision for whole-body visibility (see the build log for scores). I eat / eats me is written from the full 72-species food web plus each species' own catalogue field note, so it reads as general biology rather than only what is on that species' own workshop table.</p>
</div>`;

const html = `<style>${css}</style>
<div class="wrap" style="max-width:190mm;margin:0 auto">
${introPage}
${DECKS.map((d, i) => `
<div class="deckpage">
  <p class="eyebrow">PEBL &middot; FishSpotter &middot; species cards review</p>
  <div class="deckhdr"><span class="t">Table ${d.table} &middot; ${esc(d.title)}</span><span class="n">${d.cards.length} cards</span></div>
  <div class="grid">
    ${cardsHtml.slice(i * 8, i * 8 + 8).join('\n')}
  </div>
</div>`).join('\n')}
</div>
<svg width="0" height="0" style="position:absolute">${SPRITE}</svg>`;

writeFileSync(OUT, html);
console.log(`wrote ${OUT} — ${DECKS.reduce((n,d)=>n+d.cards.length,0)} cards`);
console.log(`\nPHOTO SOURCING: ${report.photo.length} real photo, ${report.silhouette.length} silhouette fallback (no print-safe licence cached):`);
console.log('  ' + report.silhouette.join(', '));
if (report.dietMissing.length) console.log(`\n!! DIET MISSING for ${report.dietMissing.length}: ` + report.dietMissing.join(', '));
else console.log('\nDIET: all 40 species have a hand-written, full-food-web-grounded I EAT / EATS ME.');
