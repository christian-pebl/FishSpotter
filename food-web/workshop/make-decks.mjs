// Build 5 self-contained table decks (8 animal cards each) for the workshop.
// The four energy sources are PRINTED ON THE MAT, so every animal card can always
// connect to something. Each deck must contain a 3-step chain and a mix of
// farm-created / here-anyway species. Deterministic: same output every run.
//   node food-web/workshop/make-decks.mjs
import { SPECIES, RES, E, farmOf } from '../build-foodweb.mjs';

const RESSET = new Set(Object.keys(RES));
const eats = {}, eaten = {};
for (const [a, b] of E) { (eats[b] ??= []).push(a); (eaten[a] ??= []).push(b); }
const byName = Object.fromEntries(SPECIES.map(s => [s.name, s]));
const isSp = n => !!byName[n];

// Hand-curated decks. Each is a story a table can build on its own, using only
// its 8 cards plus the four energy sources printed on the mat. Every card can
// eat something present; every table keeps survivors after the farm is removed.
const DECKS = [
  { table: 1, title: 'The kelp canopy', story: 'Seaweed feeds the grazers, the grazers feed the wrasse, the wrasse feeds the cormorant.',
    cards: ['Common Limpet','Edible sea urchin','Painted Top Shell','Ballan wrasse','Two-spotted goby','Spider Crab','Thick-lipped mullet','Great cormorant'] },
  { table: 2, title: 'The mussel ropes', story: 'Everything here is queueing for the same meal: the mussels.',
    cards: ['Dog Whelk','Velvet Swimming Crab','Spiny Starfish','Common Starfish','Common Brittlestar','Shore Crab','Edible Crab','Common eider'] },
  { table: 3, title: 'The rope shoal', story: 'Plankton to sprat to pollack to a diving bird, in four steps.',
    cards: ['Sprat','Sand smelt','Fifteen-spined stickleback','Poor cod','Bib','Pollack','Atlantic cod','European shag'] },
  { table: 4, title: 'The seabed crew', story: 'What falls from the farm feeds the bottom, and something big is living in the anchor blocks.',
    cards: ['Hermit Crab','Butterfish','Shanny','Rock goby','Curled Octopus','Conger eel','Lesser-spotted catshark','Grey seal'] },
  { table: 5, title: 'The open sand', story: 'The table that barely changes. One of you actually does better without the farm.',
    cards: ['Sea potato','Purple heart urchin','Dragonet','Sand goby','Long-spined sea scorpion','Plaice','Flounder','Harbour seal'] },
];

const used = new Set();
const decks = DECKS.map(d => {
  const deck = [];
  for (const n of d.cards) {
    if (!isSp(n)) { console.log(`   !! "${n}" is not a species in the food web`); continue; }
    if (used.has(n)) { console.log(`   !! "${n}" dealt twice`); continue; }
    used.add(n); deck.push(byName[n]);
  }
  return { ...d, deck };
});

// ---- report + validate ----
let bad = 0;
for (const d of decks) {
  const names = new Set(d.deck.map(s => s.name));
  console.log(`\n=== TABLE ${d.table}: ${d.title} ===`);
  for (const s of d.deck) {
    const prey = (eats[s.name] || []).filter(p => names.has(p) || RESSET.has(p));
    const preds = (eaten[s.name] || []).filter(p => names.has(p));
    const flag = { created: 'FARM-BUILT', enhanced: 'boosted', harmed: 'BETTER WITHOUT', anyway: 'here anyway' }[farmOf(s.name)];
    if (!prey.length) { console.log(`   !! ${s.name} has nothing to eat on this table`); bad++; }
    console.log(`   ${s.name.padEnd(28)} [${flag}]  eats: ${prey.join(', ') || 'NOTHING'}${preds.length ? `  | eaten by: ${preds.join(', ')}` : ''}`);
  }
  const created = d.deck.filter(s => farmOf(s.name) === 'created').length;
  const survivors = d.deck.filter(s => farmOf(s.name) !== 'created').length;
  console.log(`   -> ${created} farm-built, ${survivors} survive, ${d.deck.length} cards`);
  if (!created) { console.log('   !! no farm-built species: the removal moment does nothing here'); bad++; }
  if (survivors < 2) { console.log('   !! fewer than 2 survivors: this table goes dead after the removal'); bad++; }
}
const total = decks.reduce((n, d) => n + d.deck.length, 0);
console.log(`\n${total} cards across ${decks.length} tables · ${bad} problem(s)`);
console.log('sea potato (the "better without" card) is on table:',
  decks.find(d => d.deck.some(s => s.name === 'Sea potato'))?.table ?? 'NOT DEALT');
