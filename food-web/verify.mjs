// Cross-check the food-web data against the live species catalogue.
//   node food-web/verify.mjs
// Checks NAMES (against src/data/species-traits.json), LOCATIONS (zone/proximity
// vs each species' catalogue habitat) and RELATIONSHIPS (link endpoints, trophic
// direction, dead ends). Read-only: exits 1 if any hard error is found.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { SPECIES, RES, E, FARM, farmOf } from './build-foodweb.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CAT = JSON.parse(readFileSync(join(HERE,'..','src','data','species-traits.json'),'utf8'));

const errors = [], warns = [];
const err = m => errors.push(m), warn = m => warns.push(m);
const H = t => console.log(`\n=== ${t} ===`);

// catalogue lookups: commonName -> {sci, entry}
const byCommon = new Map();
for(const [sci,v] of Object.entries(CAT)){
  if(byCommon.has(v.commonName)) warn(`catalogue has duplicate commonName "${v.commonName}"`);
  byCommon.set(v.commonName, {sci, ...v});
}

// ---------- 1. NAMES ----------
H('1. NAMES vs src/data/species-traits.json');
const seen = new Set();
for(const s of SPECIES){
  if(seen.has(s.name)) err(`duplicate species in food web: "${s.name}"`);
  seen.add(s.name);
  if(!byCommon.has(s.name)){
    // try a case-insensitive near match to make typos obvious
    const near = [...byCommon.keys()].find(k=>k.toLowerCase()===s.name.toLowerCase());
    err(`name not in catalogue: "${s.name}"${near?`  (catalogue spells it "${near}")`:''}`);
  }
}
const missing = [...byCommon.keys()].filter(c=>!seen.has(c));
if(missing.length) err(`catalogue species missing from the food web (${missing.length}): ${missing.join(', ')}`);
console.log(`food web ${SPECIES.length} species · catalogue ${byCommon.size} · matched ${SPECIES.filter(s=>byCommon.has(s.name)).length}`);

// FARM keys must be real species names (a typo silently misclassifies)
for(const k of Object.keys(FARM)) if(!seen.has(k)) err(`FARM key is not a food-web species: "${k}"`);
// short labels shouldn't be blank/overlong
for(const s of SPECIES) if(!s.short || s.short.length>18) warn(`short label odd for ${s.name}: "${s.short}"`);

// ---------- 2. LOCATIONS ----------
H('2. LOCATIONS (zone + proximity vs catalogue habitat)');
const ZONE_OK = {
  surface: e => e.shapeClass==='other',
  open:    e => ['open-water','midwater','near-surface'].some(h=>e.habitat?.includes(h)),
  seabed:  e => ['sandy-bottom','rocky-crevice'].some(h=>e.habitat?.includes(h))
              || ['on-bottom','burrowing','hiding'].some(b=>e.behavior?.includes(b)),
  canopy:  e => ['kelp','rocky-crevice','near-surface'].some(h=>e.habitat?.includes(h)),
  mussel:  e => ['rocky-crevice','kelp','midwater','sandy-bottom','open-water'].some(h=>e.habitat?.includes(h)),
};
for(const s of SPECIES){
  const e = byCommon.get(s.name); if(!e) continue;
  const test = ZONE_OK[s.zone];
  if(!test) { err(`unknown zone "${s.zone}" on ${s.name}`); continue; }
  if(!test(e)) warn(`zone "${s.zone}" vs habitat [${(e.habitat||[]).join(', ')}], ${s.name}`);
  if(!['core','footprint','passing'].includes(s.prox)) err(`unknown proximity "${s.prox}" on ${s.name}`);
}
// internal rule: a species the FARM CREATES exists because of farm structure/kelp/mussels,
// so it should sit ON the farm (core), not merely in the enriched-seabed footprint.
for(const s of SPECIES){
  if(farmOf(s.name)==='created' && s.prox!=='core')
    err(`farm-"created" but proximity "${s.prox}" (expected core): ${s.name}`);
  if(farmOf(s.name)==='harmed' && s.prox==='core')
    warn(`farm-"harmed" yet marked core: ${s.name}`);
}
// surface band should be exactly the birds + seals
for(const s of SPECIES){
  const e=byCommon.get(s.name); if(!e) continue;
  if(e.shapeClass==='other' && s.zone!=='surface') err(`bird/seal not in surface band: ${s.name}`);
  if(e.shapeClass==='jellyfish' && s.zone!=='open') warn(`jellyfish outside open water: ${s.name}`);
  if(e.shapeClass==='flatfish' && s.zone!=='seabed') err(`flatfish not on the seabed: ${s.name}`);
}

// ---------- 3. RELATIONSHIPS ----------
H('3. RELATIONSHIPS');
const valid = new Set([...seen, ...Object.keys(RES)]);
const tier = Object.fromEntries(SPECIES.map(s=>[s.name,s.tier]));
const eats={}, eaten={}, pairs=new Set();
for(const [a,b] of E){
  if(!valid.has(a)) err(`link from unknown node "${a}"`);
  if(!valid.has(b)) err(`link to unknown node "${b}"`);
  if(a===b) err(`self-link on "${a}"`);
  const k=a+'>'+b; if(pairs.has(k)) err(`duplicate link ${a} -> ${b}`); pairs.add(k);
  if(pairs.has(b+'>'+a)) warn(`mutual predation ${a} <-> ${b} (check this is intended)`);
  if(tier[a]!=null && tier[b]!=null && tier[a]>tier[b]) err(`inverted trophic link ${a}(T${tier[a]}) -> ${b}(T${tier[b]})`);
  (eats[b]??=[]).push(a); (eaten[a]??=[]).push(b);
}
const noFood = SPECIES.filter(s=>!eats[s.name]);
if(noFood.length) err(`species that eat nothing (${noFood.length}): ${noFood.map(s=>s.name).join(', ')}`);
const TERMINAL_OK = new Set(['European shag','Great cormorant','Common eider','Grey seal','Harbour seal',
  'Common Starfish','Spiny Starfish','Cushion Star','Compass Jellyfish','Barrel Jellyfish','Mauve Stinger',"Lion's Mane Jellyfish"]);
for(const s of SPECIES) if(!eaten[s.name] && !TERMINAL_OK.has(s.name))
  err(`no predator and not an expected terminal: ${s.name}`);
for(const t of TERMINAL_OK) if(eaten[t]) console.log(`  note: "${t}" now has a predator (${eaten[t].join(', ')}), fine, just no longer terminal`);
// every basal resource must feed something; every species must reach a basal resource
for(const r of Object.keys(RES)) if(!eaten[r]) err(`energy source feeds nothing: ${r}`);
const RESSET=new Set(Object.keys(RES));
function reachesBase(n, seenSet=new Set()){
  if(RESSET.has(n)) return true;
  if(seenSet.has(n)) return false; seenSet.add(n);
  return (eats[n]||[]).some(p=>reachesBase(p,seenSet));
}
for(const s of SPECIES) if(!reachesBase(s.name)) err(`no path down to a basal energy source: ${s.name}`);
console.log(`${E.length} links · ${SPECIES.length} species · ${Object.keys(RES).length} energy sources`);

// ---------- 4. FARM IMPACT ----------
H('4. FARM IMPACT split');
const counts={created:0,enhanced:0,harmed:0,anyway:0};
for(const s of SPECIES) counts[farmOf(s.name)]++;
console.log(counts);
const createdSet=new Set([...SPECIES.filter(s=>farmOf(s.name)==='created').map(s=>s.name),
  ...Object.keys(RES).filter(k=>RES[k].farm==='created')]);
const baseLinks=E.filter(([a,b])=>!createdSet.has(a)&&!createdSet.has(b));
const baseSp=SPECIES.filter(s=>farmOf(s.name)!=='created');
// nothing surviving the baseline should depend solely on farm-created food
for(const s of baseSp){
  const food=(eats[s.name]||[]).filter(p=>!createdSet.has(p));
  if(!food.length) err(`survives baseline but all its food is farm-created: ${s.name}`);
}
console.log(`baseline: ${baseSp.length} species · ${baseLinks.length} links`);

// ---------- result ----------
H('RESULT');
warns.forEach(w=>console.log('  WARN  '+w));
errors.forEach(e=>console.log('  ERROR '+e));
console.log(`\n${errors.length} error(s), ${warns.length} warning(s)`);
process.exit(errors.length?1:0);
