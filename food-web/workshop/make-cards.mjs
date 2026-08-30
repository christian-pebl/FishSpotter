// Build the 40 workshop species cards (front + back) as a colour, PEBL-branded
// contact sheet for review, grouped by table, one page-pair per deck.
// Real photography (print-safe licence only) from the live SpeciesImage cache
// via card-photos.json (run fetch-card-photos.mjs first), real scannable QR
// codes, and the real PEBL logo. I EAT / EATS ME are per species (see DIET
// below), general biology rather than restricted to the 8 cards on that species'
// own workshop table (that restriction was a game-table artifact, not a
// scientific fact, so it does not belong on a species-reference card).
//
// SOURCE ALIGNMENT, Aug 2026. Every I EAT line has now been checked against the
// `diet:eats` claim for that species in src/data/species-references.json, which
// is the same provenance the FishSpotter species page renders. Where the card
// and the read passage disagreed, the card was changed to match the passage, so
// a visitor scanning the QR sees the app agree with the card in their hand
// rather than contradict it. Twenty lines moved. Re-check after any refs update:
// the bound quote is the authority, not this file.
//
// Two caveats worth knowing. (1) `diet:eatenBy` is much thinner than `diet:eats`
// in the reference system, because sources describe what an animal eats far more
// readily than they enumerate what eats it, so most EATS ME lines still rest on
// the food web rather than on a single read passage. (2) A few EATS ME lines name
// predators drawn from the food-web edges that no single quote covers; those were
// left alone rather than cut, because the edge itself carries its own claim.
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
const OUT_PRINT = join(HERE, 'cards-print.html');
const CAT = JSON.parse(readFileSync(join(HERE, '..', '..', 'src', 'data', 'species-traits.json'), 'utf8'));
const PHOTOS = existsSync(join(HERE, 'card-photos.json')) ? JSON.parse(readFileSync(join(HERE, 'card-photos.json'), 'utf8')) : {};
// real PEBL wordmark, dark-navy colourway, embedded byte-for-byte as a data
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
// TIERLABEL deleted with the tier chip. The trophic tier was a placement device for
// the old pre-dealt decks ("put your T2s down first"); on a single card in a hand it
// told the holder nothing, and it is not printed anywhere now. TIER survives only to
// tint a silhouette when a species has no print-safe photo, which is currently none.

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
// no import-order coupling, cross-checked against it by the report below).
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

// The NICK map (40 hand-written one-liners shown under the Latin name) was deleted
// here. It was written from each species' catalogue field note and was, in practice,
// a behaviour sentence: "Grazes algae off bare rock, always returning to the same
// spot". The species-guide sweep now supplies a SOURCED behaviour statement for all
// 72 species, so keeping both printed the same fact twice, once with a citation
// behind it and once without. The card shows the sourced one.

// 'kelp' is the catalogue's tag for the algal canopy, but the label reads
// "seaweed canopy" because that is what the sources actually describe. Of the 12
// species carrying the tag, only four have a verified habitat statement that names
// kelp (pollack "kelp forests", ballan wrasse "kelp beds", two-spotted goby
// "Laminaria kelp", painted top shell "large algae such as Laminaria"). The other
// eight say "weed-covered rock", "among seaweed", "among algae" or "weedy
// shorelines", which is wracks and reds as much as laminarians. The tag name is
// left alone: it is used across the app, the gate silhouettes and the food web.
const HAB_LABEL = { 'kelp': 'the seaweed canopy', 'rocky-crevice': 'rocky crevices', 'sandy-bottom': 'the open sand',
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

// DIET AND FACTS come from the verified species-guide data, not from this file.
//
// The hand-written DIET map that used to sit here (40 species x an "eat" and a
// "by" string) has been deleted. It was written from our own 72-node farm food
// web, which meant every line could only name animals that were already in OUR
// catalogue: the cod ate "bib, velvet swimming crab, cuttlefish" because those
// are its catalogue neighbours, not because that is what a fisheries scientist
// would say. It was answering a question about the catalogue while looking like
// an answer about the animal.
//
// The species-guide sweep (PR #152, 28 Aug 2026) replaced that with broad
// statements read from published accounts: `src/data/species-diet.json` holds
// roughly three `eats` and three `eatenBy` bullets per species, each traceable
// to a passage somebody read, and `src/data/species-facts.json` holds verified
// depth / size / habitat / behaviour text. 966 of 1007 claims are evidenced.
//
// The card now MIRRORS those files rather than paraphrasing them, so a visitor
// scanning the QR sees the app agree with the card in their hand. Anything that
// needs correcting should be corrected there, not here; this file only chooses
// how much of it fits on A6.
const DIET_DATA  = JSON.parse(readFileSync(join(HERE, '..', '..', 'src', 'data', 'species-diet.json'), 'utf8'));
const FACTS_DATA = JSON.parse(readFileSync(join(HERE, '..', '..', 'src', 'data', 'species-facts.json'), 'utf8'));

// How many of each species' bullets reach the card. The guide page shows all of
// them; an A6 back cannot, so the card takes the first N. The bullets are
// authored most-representative-first, so a truncation is a subset of the page's
// claim rather than a different one, and the QR goes to the full list.
const BULLET_BUDGET = Number(process.env.CARD_BULLET_BUDGET || 200);
const BEHAVIOUR_BUDGET = Number(process.env.CARD_BEHAVIOUR_BUDGET || 80);
const PHOTO_H = Number(process.env.CARD_PHOTO_H || 17);
const BORDER  = Number(process.env.CARD_BORDER || 1.3);   // white margin on the SIDES only, mm at source (x2.39 at A6)
const STRIP   = Number(process.env.CARD_STRIP  || 2.4);     // height of the head and foot bands

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

const cardsHtml = [];   // review contact sheet: front + back side by side
const CARDS = [];       // print imposition: front and back kept apart
const report = { photo: [], silhouette: [], dietMissing: [], factsMissing: [] };
// Bullets are chosen by CHARACTER BUDGET, not by a fixed count, because the
// authored statements vary from 16 to 190 characters and a fixed count either
// wastes half the card on the terse species or overflows on the verbose ones.
// Fill in order (they are authored most-representative-first) while the running
// total fits, always keeping at least one. Measured against every card back:
// this lands most species on three bullets a side and the wordiest on two.
// Behaviour statements run to a median of 123 characters and a max of 158, which
// no A6 front can hold beside a photo, a name and a size. Rather than truncate
// mid-sentence, cut at the last clause boundary that fits: these texts are written
// as "primary behaviour; secondary detail", so the first clause is the useful half
// and what remains is a true prefix of the page's claim, not a reworded one.
const clip = (text, budget) => {
  if (!text || text.length <= budget) return text || '';
  const head = text.slice(0, budget);
  const cut = Math.max(head.lastIndexOf('; '), head.lastIndexOf('. '));
  return cut > budget * 0.45 ? text.slice(0, cut) : head.slice(0, head.lastIndexOf(' ')) + '...';
};
const frontFact = (label, text) => text
  ? `<div class="field"><b>${label}</b><span>${esc(text)}</span></div>` : '';

const bullets = list => {
  const out = [];
  let used = 0;
  for (const b of list || []) {
    if (out.length && used + b.text.length > BULLET_BUDGET) break;
    out.push(b); used += b.text.length;
    if (out.length >= 3) break;                       // the guide page holds the rest
  }
  return `<ul class="blist">${out.map(b => `<li>${esc(b.text)}</li>`).join('')}</ul>`;
};

for (const deck of DECKS) {
  for (const name of deck.cards) {
    const sp = byName[name];
    const e = byCommon.get(name);
    if (!sp || !e) { console.warn('MISSING catalogue entry for', name); continue; }
    const diet  = DIET_DATA[e.sci]  || { eats: [], eatenBy: [] };
    const facts = FACTS_DATA[e.sci] || {};
    if (!diet.eats.length || !diet.eatenBy.length) report.dietMissing.push(name);
    if (!facts.size || !facts.depth) report.factsMissing.push(`${name}${!facts.size ? ' (no size)' : ''}${!facts.depth ? ' (no depth)' : ''}`);
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

    const frontHtml = `
      <div class="card front">
       <div class="cardinner">
        <div class="tier-stripe"></div>
        ${media}
        <div class="namebox">
          <p class="name">${esc(name)}</p>
          <p class="sci">${esc(e.sci)}</p>
        </div>
        <div class="frontfacts">
          ${frontFact('SIZE', clip(facts.size?.text, 90))}
          ${frontFact('LIVES', HABITAT_OVERRIDE[name] || cap(habitatText(e)))}
          ${frontFact('BEHAVIOUR', clip(facts.behaviour?.text, BEHAVIOUR_BUDGET))}
        </div>
        <div class="frontfoot">
          <p class="credit">${creditLine}</p>
          <img class="pebl-logo" src="${LOGO_URI}" alt="PEBL">
        </div>
        <div class="tier-stripe"></div>
       </div>
      </div>`;

    const backHtml = `
      <div class="card back">
       <div class="cardinner">
        <div class="tier-stripe"></div>
        <div class="backbody">
        <p class="backname">${esc(name)}</p>
        <div class="field"><b>I EAT</b>${bullets(diet.eats)}</div>
        <div class="field"><b>EATS ME</b>${bullets(diet.eatenBy)}</div>
        <div class="qrrow">
          <img class="qr" src="${qrUri}">
          <div class="qrtext"><b>Scan for more.</b> Depth, behaviour, the full diet, and every source.</div>
        </div>
        <div class="cardfoot">
          <img class="pebl-logo small" src="${LOGO_URI}" alt="PEBL">
          <span>pebl-cic.co.uk</span>
        </div>
        </div>
        <div class="tier-stripe"></div>
       </div>
      </div>`;

    CARDS.push({ id: idOf(name), name, front: frontHtml, back: backHtml });
    cardsHtml.push(`<div class="pair" data-id="${idOf(name)}">${frontHtml}${backHtml}</div>`);
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
   page margin), leaves 6mm of slack. Card ratio 44:62 matches true A6 (105:148)
   so this preview is proportionally honest, not just a rough thumbnail. */
.grid{display:grid;grid-template-columns:1fr 1fr;gap:5mm 4mm}
.pair{display:flex;gap:2mm;min-width:0;break-inside:avoid;page-break-inside:avoid}
/* No border, no radius, no shadow, all deliberate. The artwork runs FULL BLEED to
   the trim on every side so that once the sheet is guillotined and the corners are
   rounded with a punch, the result reads as a playing card rather than a printed
   panel floating on paper. There is no cut line to print: the cards butt against
   each other, so a printed rule would be halved by the blade and leave a hairline
   down one card. A radius would sit inside the punched one; a shadow would smear
   grey along the cut. */
.card{width:44mm;height:58mm;flex:0 0 44mm;position:relative;overflow:hidden;background:#fff;display:flex;flex-direction:column;padding:0 ${BORDER}mm}
.tier-stripe{height:${STRIP}mm;flex:0 0 auto;background:var(--teal)}
/* White margin down the LEFT AND RIGHT edges only, with the head and foot strips
   running to the top and bottom trim. A cut that drifts sideways eats white instead of
   skewing the design, which is the common case when trimming a column of cards by eye.
   The two strips are equal so the card reads square top to bottom. */
.cardinner{flex:1 1 auto;display:flex;flex-direction:column;min-height:0;overflow:hidden;background:#fff}
.backbody{flex:1 1 auto;display:flex;flex-direction:column;min-height:0;padding:2mm 2.6mm 1.6mm}
/* FRONT */
.card.front .photo{height:${PHOTO_H}mm;width:100%;object-fit:cover;background:var(--lteal);flex:0 0 auto}
.card.front .photo.silhouette{display:flex;align-items:center;justify-content:center;padding:2.5mm}
.card.front .photo.silhouette svg{width:70%;height:70%}
.namebox{padding:1.8mm 2.6mm 0;min-width:0}
.name{margin:0;font-size:7.9pt;font-weight:bold;line-height:1.1;color:var(--navy);overflow-wrap:break-word}
.sci{margin:0.4mm 0 0;font-size:6.4pt;font-style:italic;color:#9aa7ab;overflow-wrap:break-word}
.nick{margin:0.8mm 0 0;font-size:6pt;color:var(--soft);line-height:1.25}
.frontfacts{padding:0 2.6mm;margin-top:1mm}
.frontfacts .field{margin-bottom:1.1mm}
.frontfacts .field span{font-size:5pt;line-height:1.2}
/* pinned to the foot of the card so the credit sits on the bottom edge on every
   card, whatever length the facts above it run to */
.frontfoot{margin-top:auto;padding:1.2mm 2.6mm 2.2mm;display:flex;align-items:flex-end;justify-content:space-between;gap:1.5mm;border-top:0.5pt solid var(--hair)}
.frontfoot .credit{margin:0;flex:1 1 auto;min-width:0}
.frontfoot .pebl-logo{margin:0;flex:0 0 auto}
.credit{font-size:3.9pt;color:#9aa7ab;line-height:1.12}
.pebl-logo{height:4mm;width:auto;display:block;margin:0 2.2mm 1.6mm auto;opacity:.9}
/* BACK */
.card.back{min-width:0}
.backname{margin:0 0 1.6mm;font-size:7.2pt;font-weight:bold;line-height:1.1;color:var(--navy);overflow-wrap:break-word}
.field{margin-bottom:1.4mm;min-width:0}
.field b{display:block;font-size:4.6pt;letter-spacing:.5pt;color:var(--dteal);text-transform:uppercase;margin-bottom:0.3mm}
.field span{display:block;font-size:6.1pt;line-height:1.3;color:var(--navy);overflow-wrap:break-word}
.blist{margin:0;padding-left:2.4mm;list-style:none}
.blist li{font-size:5.1pt;line-height:1.2;color:var(--navy);overflow-wrap:break-word;margin-bottom:0.5mm;position:relative}
.blist li::before{content:"•";position:absolute;left:-2.2mm;color:var(--teal)}
/* .farmbadge / .fsym / .flab / .fhint removed with the farm-status glyph itself
   (see the note where FARMBADGE used to be defined). The freed vertical space on
   the card back is left to the three content fields rather than reclaimed. */
.qrrow{margin-top:auto;display:flex;align-items:center;gap:1.4mm;border-top:0.5pt solid var(--hair);padding-top:1.2mm;min-width:0}
.qr{width:6.6mm;height:6.6mm;flex:0 0 auto}
.qrtext{font-size:4.2pt;line-height:1.2;color:var(--soft);min-width:0}
.qrtext b{color:var(--navy)}
.cardfoot{display:flex;align-items:center;gap:1.2mm;margin-top:1mm}
.cardfoot .pebl-logo{height:3mm;margin:0}
.cardfoot span{font-size:4.4pt;color:#9aa7ab;letter-spacing:.2pt}
`;

const introPage = `
<div class="deckpage">
  <p class="eyebrow">PEBL &middot; FishSpotter &middot; who lives on a seaweed farm</p>
  <h1>Species cards &mdash; review sheet</h1>
  <p class="subhead">Colour, A6 double-sided, one deck per following page (8 cards, grouped by workshop table for printing only). Front is identification: photo, name, scientific name, one-line description, verified size and where it lives. Back is the food web: what it eats and what eats it, as sourced bullets, plus a QR to that species' own guide page.</p>
  <p class="reviewnote"><b>For review. The print artwork is the separate 4-up A6 file.</b> Every photo is a real, print-safe (CC0 / CC-BY / CC-BY-SA) image showing the live animal in water or on natural substrate &mdash; none hand-held or out of habitat &mdash; each checked with Gemini vision for whole-body visibility (see the build log for scores). Size and diet are mirrored from the verified species-guide data (PR #152): each diet bullet was read from a published account, and the card shows as many as fit, with the full list one QR scan away.</p>
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
console.log(`wrote ${OUT}, ${DECKS.reduce((n,d)=>n+d.cards.length,0)} cards`);

// ---------------------------------------------------------------------------
// PRINT IMPOSITION -> cards-print.html
//
// cards.html is a REVIEW proof: the cards are drawn at 44 x 58 mm so eight fit a
// page next to each other. It is not printable artwork. This second output is the
// real thing, at true A6 (105 x 148 mm).
//
// GEOMETRY. A6 tiles A4 exactly: 2 across x 2 down is 210 x 296 mm on a 210 x 297
// sheet. That is 4 cards a page with zero waste, and because the cards share every
// edge the whole sheet cuts with two straight guillotine passes, one vertical and
// one horizontal, so no crop marks are needed or even possible (there is 0.5 mm of
// slack). Six A6 cards do not tile A4 or A3 in any orientation, see the note in the
// session log for the arithmetic and the alternatives.
//
// SCALING. The card internals are laid out against a 44 mm width. Rather than
// re-specifying forty type sizes at A6, each card is rendered at source size inside
// a wrapper and scaled up by exactly 105/44. The source height is set to
// 44 * 148/105 = 62.019 mm so the scale is uniform in both axes and nothing
// distorts; the card is a flex column with margin-top:auto on the QR row, so the
// extra height simply spreads the content.
//
// DUPLEX. Backs are laid out mirrored, [2,1,4,3], because the sheet flips about its
// vertical axis on a long-edge duplex pass. Get this wrong and every card carries
// the wrong animal's biology, which is invisible until the deck is cut.
// Exact scale, no overshoot. An earlier version scaled up 0.15% so adjacent cards
// overlapped rather than merely touched, guarding against a 1px white seam at the
// trim. The white border makes that guard both unnecessary and harmful: any seam is
// now white against white and invisible, while the overshoot was clipping 0.16mm off
// the right and bottom margins, leaving the border wider on two sides than the other
// two. Symmetry is the whole point of the border, so exact scale wins.
const SCALE = 105 / 44;
const SRC_H = 44 * 148 / 105;
const UP = 4, COLS = 2;
const printCss = `
@page{ size:A4 portrait; margin:0; }
html,body{margin:0;padding:0;background:#fff}
.psheet{width:210mm;height:296mm;display:grid;
  grid-template-columns:repeat(${COLS},105mm);grid-template-rows:repeat(${UP / COLS},148mm);
  page-break-after:always;break-after:page;overflow:hidden}
.psheet:last-child{page-break-after:auto;break-after:auto}
.pcell{width:105mm;height:148mm;overflow:hidden;position:relative}
.pscale{transform:scale(${SCALE});transform-origin:top left;width:44mm;height:${SRC_H}mm}
/* No border on the print card. It was the last thing still drawing a line at the
   trim, and a guillotine cannot follow a 0.35pt rule to the tenth of a millimetre:
   any drift leaves a grey hairline down one card and nothing on its neighbour.
   The cards butt edge to edge, so the cut is two straight passes through the sheet
   and the artwork simply meets. */
.pscale .card{width:44mm;height:${SRC_H}mm;flex:0 0 44mm}
`;

const sheets = [];
for (let i = 0; i < CARDS.length; i += UP) {
  const group = CARDS.slice(i, i + UP);
  while (group.length < UP) group.push(null);                 // pad the last sheet
  const cell = c => `<div class="pcell">${c ? `<div class="pscale">${c}</div>` : ''}</div>`;
  // fronts in reading order
  sheets.push(`<div class="psheet">${group.map(c => cell(c && c.front)).join('')}</div>`);
  // backs with the columns reversed within each row, so they land behind their own front
  const mirrored = [];
  for (let r = 0; r < UP / COLS; r++) mirrored.push(...group.slice(r * COLS, r * COLS + COLS).reverse());
  sheets.push(`<div class="psheet">${mirrored.map(c => cell(c && c.back)).join('')}</div>`);
}

writeFileSync(OUT_PRINT, `<style>${css}${printCss}</style>
${sheets.join('\n')}
<svg width="0" height="0" style="position:absolute">${SPRITE}</svg>`);
console.log(`wrote ${OUT_PRINT}, ${CARDS.length} cards at true A6, ${UP}-up, ${sheets.length} sheets (${sheets.length / 2} front + ${sheets.length / 2} back)`);
console.log(`\nPHOTO SOURCING: ${report.photo.length} real photo, ${report.silhouette.length} silhouette fallback (no print-safe licence cached):`);
console.log('  ' + report.silhouette.join(', '));
if (report.dietMissing.length) console.log(`\n!! DIET MISSING for ${report.dietMissing.length}: ` + report.dietMissing.join(', '));
else console.log(`
DIET: all 40 species carry sourced bullets (fitted to a ${BULLET_BUDGET}-character budget a side, the full list is on the guide page).`);
if (report.factsMissing.length) console.log(`!! FACTS MISSING: ${report.factsMissing.join(', ')}`);
else console.log('FACTS: all 40 species have a verified size and depth.');
