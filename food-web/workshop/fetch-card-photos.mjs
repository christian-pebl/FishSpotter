// Pull a print-safe (CC0 / CC-BY only — no NC, no SA obligations) photo for each
// of the 40 workshop-deck species from the live SpeciesImage cache, plus the
// scientific-name lookup from the catalogue. Writes card-photos.json.
//   npx tsx --env-file=.env.local food-web/workshop/fetch-card-photos.mjs
import { PrismaClient } from '@prisma/client';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { SPECIES } from '../build-foodweb.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CAT = JSON.parse(readFileSync(join(HERE, '..', '..', 'src', 'data', 'species-traits.json'), 'utf8'));

// commonName (as used in the food web) -> scientific name (SpeciesImage key)
const byCommon = new Map();
for (const [sci, v] of Object.entries(CAT)) byCommon.set(v.commonName, sci);
// the food web sometimes uses a shorter/different-case label than the catalogue's
// commonName; these are the deck species whose exact string differs
const ALIAS = {
  'Common Limpet': 'Common Limpet', 'Edible sea urchin': 'Edible sea urchin',
  'Painted Top Shell': 'Painted Top Shell', 'Ballan wrasse': 'Ballan wrasse',
  'Two-spotted goby': 'Two-spotted goby', 'Spider Crab': 'Spider Crab',
  'Thick-lipped mullet': 'Thick-lipped mullet', 'Great cormorant': 'Great cormorant',
  'Dog Whelk': 'Dog Whelk', 'Velvet Swimming Crab': 'Velvet Swimming Crab',
  'Spiny Starfish': 'Spiny Starfish', 'Common Starfish': 'Common Starfish',
  'Common Brittlestar': 'Common Brittlestar', 'Shore Crab': 'Shore Crab',
  'Edible Crab': 'Edible Crab', 'Common eider': 'Common eider',
  'Sprat': 'Sprat', 'Sand smelt': 'Sand smelt', 'Fifteen-spined stickleback': 'Fifteen-spined stickleback',
  'Poor cod': 'Poor cod', 'Bib': 'Bib', 'Pollack': 'Pollack', 'Atlantic cod': 'Atlantic cod',
  'European shag': 'European shag', 'Hermit Crab': 'Hermit Crab', 'Butterfish': 'Butterfish',
  'Shanny': 'Shanny', 'Rock goby': 'Rock goby', 'Curled Octopus': 'Curled Octopus',
  'Conger eel': 'Conger eel', 'Lesser-spotted catshark': 'Lesser-spotted catshark', 'Grey seal': 'Grey seal',
  'Sea potato': 'Sea potato', 'Purple heart urchin': 'Purple heart urchin', 'Dragonet': 'Dragonet',
  'Sand goby': 'Sand goby', 'Long-spined sea scorpion': 'Long-spined sea scorpion',
  'Plaice': 'Plaice', 'Flounder': 'Flounder', 'Harbour seal': 'Harbour seal',
};
const DECK_NAMES = Object.keys(ALIAS);

const prisma = new PrismaClient();
const PRINT_SAFE = new Set(['cc0', 'cc-by', 'pdm']);

const out = {};
const missing = [], licenseBlocked = [];

for (const commonName of DECK_NAMES) {
  const sci = byCommon.get(commonName);
  if (!sci) { missing.push(commonName + ' (no catalogue entry)'); continue; }
  const rows = await prisma.speciesImage.findMany({
    where: { scientificName: sci },
    orderBy: [{ curated: 'desc' }, { ordering: 'asc' }],
  });
  const safe = rows.filter(r => PRINT_SAFE.has(r.license.toLowerCase()));
  if (!safe.length) {
    if (rows.length) licenseBlocked.push(`${commonName} (${rows.length} photo(s), all ${[...new Set(rows.map(r=>r.license))].join('/')})`);
    else missing.push(commonName + ' (no cached photo at all)');
    continue;
  }
  const pick = safe[0];
  out[commonName] = {
    scientificName: sci,
    url: pick.webpUrl || pick.url,
    attribution: pick.attribution,
    license: pick.license,
    sourceUrl: pick.sourceUrl,
    source: pick.source,
    placeGuess: pick.placeGuess,
    observedOn: pick.observedOn,
  };
}

writeFileSync(join(HERE, 'card-photos.json'), JSON.stringify(out, null, 2));
console.log(`resolved ${Object.keys(out).length}/${DECK_NAMES.length} species with a print-safe photo`);
if (licenseBlocked.length) console.log(`\nBLOCKED BY LICENSE (has photos, but none CC0/CC-BY) — ${licenseBlocked.length}:\n  ` + licenseBlocked.join('\n  '));
if (missing.length) console.log(`\nNO PHOTO AT ALL — ${missing.length}:\n  ` + missing.join('\n  '));
await prisma.$disconnect();
