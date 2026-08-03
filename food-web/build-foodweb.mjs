// Build a self-contained "Farm Food Web" HTML artifact for FishSpotter.
// Rebuilds Christian's "Biodiversity Mechanisms" farm cross-section (light navy +
// tan palette, mussel lines left / seaweed canopy right / seabed reef) and lays
// all 72 catalogue species onto it as square tiles by trophic tier + farm
// proximity, with food-web arrows and the two farm-subsidy directions.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';

// Paths resolve relative to this script, so it rebuilds anywhere in the repo.
const HERE = dirname(fileURLToPath(import.meta.url));      // <repo>/food-web
const SIL = join(HERE, '..', 'public', 'silhouettes');    // reads the PEBL silhouettes
const OUT = join(HERE, '..', 'public', 'food-web.html');  // self-contained, served at /food-web.html

export const FORMS = {
  'cod-like':'forms/cod-like.svg','wrasse':'forms/wrasse.svg','long-skinny':'forms/long-skinny.svg',
  'bottom-sitter':'forms/bottom-sitter.svg','bottom-other':'forms/bottom-other.svg',
  'silver-shoaler':'forms/silver-shoaler.svg','shark':'forms/shark.svg','flatfish':'flatfish.svg',
  'broad-carapace':'forms/broad-carapace.svg','swimming':'forms/swimming.svg','spider':'forms/spider.svg','hermit':'forms/hermit.svg',
  'cuttlefish':'forms/cuttlefish.svg','squid':'forms/squid.svg','bobtail':'forms/bobtail.svg','octopus':'forms/octopus.svg',
  'short-stubby':'forms/short-stubby.svg','long-spiny':'forms/long-spiny.svg','long-smooth':'forms/long-smooth.svg','thin-whippy':'forms/thin-whippy.svg',
  'flat-cone':'forms/flat-cone.svg','pointed-cone':'forms/pointed-cone.svg','rounded-squat':'forms/rounded-squat.svg',
  'saucer':'forms/saucer.svg','trailing-mass':'forms/trailing-mass.svg','frilly-arms':'forms/frilly-arms.svg',
  'round-spiny':'forms/round-spiny.svg','heart-shaped':'forms/heart-shaped.svg',
  'bird':'forms/bird.svg','seal':'forms/seal.svg',
};
function symbolFor(form){
  const raw = readFileSync(join(SIL, FORMS[form]),'utf8');
  const vb = (raw.match(/viewBox="([^"]+)"/)||[])[1] || '0 0 64 64';
  const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'').trim();
  return `<symbol id="f-${form}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet"><g fill="currentColor" stroke="none">${inner}</g></symbol>`;
}
const SPRITE = Object.keys(FORMS).map(symbolFor).join('\n');

// ---- Species catalogue (72) -------------------------------------------------
const S=(name,short,form,tier,zone,prox)=>({name,short,form,tier,zone,prox});
export const SPECIES = [
  // SURFACE — apex divers & seals
  S('European shag','Shag','bird',5,'surface','core'),
  S('Great cormorant','Cormorant','bird',5,'surface','core'),
  S('Common eider','Eider','bird',5,'surface','core'),
  S('Grey seal','Grey seal','seal',5,'surface','core'),
  S('Harbour seal','Harbour seal','seal',5,'surface','core'),
  // MUSSEL LINES (left) — shellfish predators + patrolling fish/cephalopods
  S('Common Starfish','Common starfish','long-smooth',3,'mussel','core'),
  S('Spiny Starfish','Spiny starfish','long-spiny',3,'mussel','core'),
  S('Dog Whelk','Dog whelk','pointed-cone',3,'mussel','core'),
  S('Velvet Swimming Crab','Velvet crab','swimming',3,'mussel','core'),
  S('Common Cuttlefish','Cuttlefish','cuttlefish',4,'mussel','core'),
  S('Cuckoo wrasse','Cuckoo wrasse','wrasse',3,'mussel','core'),
  S('Bib','Bib','cod-like',3,'mussel','core'),
  S('Poor cod','Poor cod','cod-like',3,'mussel','core'),
  S('Pollack','Pollack','cod-like',4,'mussel','core'),
  S('Saithe','Saithe','cod-like',4,'mussel','core'),
  S('Atlantic cod','Atlantic cod','cod-like',4,'mussel','core'),
  S('European sea bass','Sea bass','silver-shoaler',4,'mussel','core'),
  // SEAWEED CANOPY (right) — grazers, epifauna, nursery fish
  S('Common Limpet','Limpet','flat-cone',2,'canopy','core'),
  S('Painted Top Shell','Painted top','pointed-cone',2,'canopy','core'),
  S('Flat Top Shell','Flat top','rounded-squat',2,'canopy','core'),
  S('Edible sea urchin','Edible urchin','round-spiny',2,'canopy','core'),
  S('Green sea urchin','Green urchin','round-spiny',2,'canopy','core'),
  S('Spider Crab','Spider crab','spider',3,'canopy','core'),
  S('Two-spotted goby','2-spot goby','bottom-sitter',3,'canopy','core'),
  S('Fifteen-spined stickleback','15-spine stickle','long-skinny',3,'canopy','core'),
  S('Corkwing wrasse','Corkwing','wrasse',3,'canopy','core'),
  S('Goldsinny wrasse','Goldsinny','wrasse',3,'canopy','core'),
  S('Thick-lipped mullet','Thick-lip mullet','silver-shoaler',2,'canopy','footprint'),
  S('Ballan wrasse','Ballan wrasse','wrasse',4,'canopy','core'),
  // OPEN — pass-through pelagics & drifting jellyfish
  S('Sprat','Sprat','silver-shoaler',3,'open','passing'),
  S('Sand smelt','Sand smelt','silver-shoaler',3,'open','passing'),
  S('Atlantic mackerel','Mackerel','silver-shoaler',3,'open','passing'),
  S('Atlantic horse mackerel','Horse mackerel','silver-shoaler',3,'open','passing'),
  S('Veined Squid','Veined squid','squid',4,'open','footprint'),
  S('European Squid','European squid','squid',4,'open','passing'),
  S('Moon Jellyfish','Moon jelly','saucer',3,'open','passing'),
  S('Compass Jellyfish','Compass jelly','saucer',3,'open','passing'),
  S('Blue Jellyfish','Blue jelly','saucer',3,'open','passing'),
  S('Barrel Jellyfish','Barrel jelly','frilly-arms',3,'open','passing'),
  S('Mauve Stinger','Mauve stinger','saucer',3,'open','passing'),
  S("Lion's Mane Jellyfish","Lion's mane",'trailing-mass',4,'open','passing'),
  // SEABED — scavengers, deposit feeders, benthic predators (biodeposit footprint)
  S('Shore Crab','Shore crab','broad-carapace',3,'seabed','core'),
  S('Edible Crab','Edible crab','broad-carapace',4,'seabed','core'),
  S('Harbour Crab','Harbour crab','swimming',3,'seabed','footprint'),
  S('Hermit Crab','Hermit crab','hermit',3,'seabed','core'),
  S('Cushion Star','Cushion star','short-stubby',2,'seabed','core'),
  S('Common Brittlestar','Brittlestar','thin-whippy',2,'seabed','core'),
  S('Purple sea urchin','Purple urchin','round-spiny',2,'seabed','core'),
  S('Sea potato','Sea potato','heart-shaped',2,'seabed','footprint'),
  S('Purple heart urchin','Heart urchin','heart-shaped',2,'seabed','footprint'),
  S('Plaice','Plaice','flatfish',3,'seabed','footprint'),
  S('Dab','Dab','flatfish',3,'seabed','footprint'),
  S('Flounder','Flounder','flatfish',3,'seabed','footprint'),
  S('Grey gurnard','Grey gurnard','bottom-other',3,'seabed','footprint'),
  S('Red gurnard','Red gurnard','bottom-other',3,'seabed','footprint'),
  S('Tub gurnard','Tub gurnard','bottom-other',3,'seabed','footprint'),
  S('Streaked gurnard','Streaked gurnard','bottom-other',3,'seabed','footprint'),
  S('Red mullet','Red mullet','bottom-other',3,'seabed','footprint'),
  S('Dragonet','Dragonet','bottom-sitter',3,'seabed','footprint'),
  S('Spotted dragonet','Spotted dragonet','bottom-sitter',3,'seabed','footprint'),
  S('Sand goby','Sand goby','bottom-sitter',3,'seabed','footprint'),
  S('Common goby','Common goby','bottom-sitter',3,'seabed','footprint'),
  S('Rock goby','Rock goby','bottom-sitter',3,'seabed','core'),
  S('Butterfish','Butterfish','long-skinny',3,'seabed','core'),
  S('Shanny','Shanny','bottom-other',3,'seabed','core'),
  S('Long-spined sea scorpion','Sea scorpion','bottom-other',3,'seabed','core'),
  S('Whiting','Whiting','cod-like',3,'seabed','footprint'),
  S('Lesser-spotted catshark','Catshark','shark',4,'seabed','footprint'),
  S('Atlantic Bobtail','Bobtail','bobtail',3,'seabed','footprint'),
  S('Curled Octopus','Curled octopus','octopus',4,'seabed','core'),
  S('Common Octopus','Common octopus','octopus',4,'seabed','core'),
  S('Conger eel','Conger eel','long-skinny',4,'seabed','core'),
];

// ---- Resource / energy inputs (placed on the farm features) -----------------
export const RES = {
  'Kelp canopy':   {label:'Kelp / seaweed', sub:'seaweed & the life on it', col:'#8FA93E', zone:'canopy', farm:'created'},
  'Farmed mussels':{label:'Farmed mussels',  sub:'filter feeders on the ropes', col:'#8E7FB0', zone:'mussel', farm:'created'},
  'Plankton':      {label:'Plankton',        sub:'phyto- & zooplankton', col:'#7FB4CE', zone:'open', farm:'anyway'},
  'Seabed biodeposits':{label:'Detritus & seabed life', sub:'the rain-down landing zone', col:'#B08A5C', zone:'seabed', farm:'anyway'},
};

// ---- Farm impact: presence AT THIS SITE (soft-sediment + open-water baseline) --
// 'created'  = would be absent without the farm's structure / kelp / mussels
// 'enhanced' = present anyway, but fewer without the farm
// 'harmed'   = actually MORE abundant without the farm (biodeposits suppress it)
// default 'anyway' = a soft-sediment / open-water native, ~unchanged.
// Grounded in the artificial-reef, canopy-nursery and biodeposition literature.
//
// 'created' is deliberately RESTRICTED to species that physically cannot occupy
// bare soft sediment: hard-substrate obligates (limpets, top shells, urchins,
// whelks, the two big starfish) and small, site-attached crevice/weed fish with
// home ranges of metres (blennies, rock goby, sea scorpion, the weed gobies and
// stickleback). For those, "no hard surface" really does mean "not here".
//
// It is NOT applied to large, wide-ranging animals that the farm merely draws in
// from surrounding ground — the attraction-vs-production distinction in the
// artificial-reef literature. Ballan and cuckoo wrasse and both octopuses were
// reclassified 'created' -> 'enhanced' on exactly that ground (2026-08-03): all
// four range over hundreds of metres, occupy any nearby reef or debris, and are
// concentrated by the farm rather than brought into existence by it. Claiming
// them as farm-built overstates what a farm demonstrably does.
export const FARM = {
  // hard-substrate + weed/crevice obligates -> genuinely nowhere to live on bare sand
  'Bib':'created','Corkwing wrasse':'created',
  'Goldsinny wrasse':'created','Conger eel':'created','Butterfish':'created','Two-spotted goby':'created',
  'Rock goby':'created','Poor cod':'created','Long-spined sea scorpion':'created','Shanny':'created',
  'Fifteen-spined stickleback':'created','Velvet Swimming Crab':'created',
  'Cushion Star':'created','Spiny Starfish':'created','Common Limpet':'created',
  'Dog Whelk':'created','Painted Top Shell':'created','Flat Top Shell':'created','Edible sea urchin':'created',
  'Green sea urchin':'created','Purple sea urchin':'created',
  // present anyway, boosted by the structure / mussels / prey aggregation. The
  // wrasses and octopuses sit here because the farm concentrates them, not because
  // it creates them (see the note above).
  'Pollack':'enhanced','Saithe':'enhanced','Atlantic cod':'enhanced','Spider Crab':'enhanced',
  'Common Starfish':'enhanced','Common Brittlestar':'enhanced','Common eider':'enhanced',
  'Ballan wrasse':'enhanced','Cuckoo wrasse':'enhanced',
  'Curled Octopus':'enhanced','Common Octopus':'enhanced',
  // clean-sand specialist that heavy biodeposition suppresses -> does better without
  'Sea potato':'harmed',
};
export const farmOf = n => FARM[n] || 'anyway';

// ---- Food-web edges: [prey/resource, predator/consumer] ---------------------
export const E=[];
const link=(to,...froms)=>froms.forEach(f=>E.push([f,to]));
link('Common Limpet','Kelp canopy'); link('Painted Top Shell','Kelp canopy'); link('Flat Top Shell','Kelp canopy');
link('Edible sea urchin','Kelp canopy'); link('Green sea urchin','Kelp canopy'); link('Purple sea urchin','Kelp canopy');
link('Spider Crab','Kelp canopy'); link('Thick-lipped mullet','Kelp canopy');
link('Common Brittlestar','Kelp canopy','Plankton','Seabed biodeposits');
link('Cushion Star','Seabed biodeposits','Kelp canopy'); link('Sea potato','Seabed biodeposits'); link('Purple heart urchin','Seabed biodeposits');
link('Hermit Crab','Seabed biodeposits'); link('Shore Crab','Seabed biodeposits'); link('Harbour Crab','Seabed biodeposits');
link('Common goby','Seabed biodeposits'); link('Sand goby','Seabed biodeposits');
link('Farmed mussels','Plankton');
link('Sprat','Plankton'); link('Sand smelt','Plankton'); link('Two-spotted goby','Plankton');
link('Atlantic mackerel','Plankton'); link('Atlantic horse mackerel','Plankton'); link('Atlantic Bobtail','Plankton');
link('Moon Jellyfish','Plankton'); link('Compass Jellyfish','Plankton'); link('Blue Jellyfish','Plankton');
link('Barrel Jellyfish','Plankton'); link('Mauve Stinger','Plankton');
link('Dog Whelk','Farmed mussels'); link('Common Starfish','Farmed mussels'); link('Spiny Starfish','Farmed mussels');
link('Edible Crab','Farmed mussels'); link('Velvet Swimming Crab','Farmed mussels'); link('Common eider','Farmed mussels');
link('Curled Octopus','Farmed mussels'); link('Common Octopus','Farmed mussels');
link('Ballan wrasse','Common Limpet','Painted Top Shell','Flat Top Shell','Edible sea urchin','Green sea urchin','Purple sea urchin','Spider Crab','Dog Whelk');
link('Common Starfish','Common Brittlestar'); link('Plaice','Common Brittlestar','Sea potato','Purple heart urchin');
link('Dab','Common Brittlestar'); link('Flounder','Common Brittlestar','Sea potato');
link('Lesser-spotted catshark','Common Brittlestar','Hermit Crab','Shore Crab','Harbour Crab','Sea potato');
link('Grey gurnard','Common Brittlestar','Shore Crab'); link('Red gurnard','Common Brittlestar','Hermit Crab');
link('Tub gurnard','Shore Crab','Common Brittlestar'); link('Streaked gurnard','Common Brittlestar');
link('Common Cuttlefish','Spider Crab','Hermit Crab','Shore Crab','Harbour Crab');
link('Curled Octopus','Spider Crab','Hermit Crab','Shore Crab','Velvet Swimming Crab');
link('Common Octopus','Spider Crab','Hermit Crab','Shore Crab','Velvet Swimming Crab','Edible Crab');
link('European sea bass','Sprat','Sand smelt','Two-spotted goby','Atlantic mackerel','Atlantic horse mackerel','Corkwing wrasse','Goldsinny wrasse','Red mullet');
link('Pollack','Sprat','Two-spotted goby','Fifteen-spined stickleback','Sand smelt','Poor cod');
link('Saithe','Sprat','Poor cod');
link('Atlantic cod','Sprat','Poor cod','Whiting','Bib','Sand goby','Shore Crab','Velvet Swimming Crab','Spider Crab','Common Cuttlefish','Corkwing wrasse');
link('Long-spined sea scorpion','Fifteen-spined stickleback','Sand goby','Common goby');
link('Veined Squid','Sprat','Atlantic mackerel'); link('European Squid','Sprat');
link('Conger eel','Shore Crab','Velvet Swimming Crab','Edible Crab','Butterfish','Shanny','Poor cod','Whiting','Bib','Corkwing wrasse','Curled Octopus','Common Octopus','Lesser-spotted catshark');
link('Sand goby','Plankton'); link('Common goby','Plankton'); link('Rock goby','Plankton'); link('Butterfish','Seabed biodeposits');
link("Lion's Mane Jellyfish",'Moon Jellyfish','Blue Jellyfish');
link('Grey seal','Pollack','Saithe','Atlantic cod','Atlantic mackerel','Atlantic horse mackerel','European sea bass','Ballan wrasse','Common Cuttlefish','Veined Squid','European Squid','Edible Crab','Conger eel','Lesser-spotted catshark','Plaice','Curled Octopus','Common Octopus','Poor cod','Whiting');
link('Harbour seal','European sea bass','Veined Squid','European Squid','Pollack','Sand smelt','Flounder','Dab');
link('European shag','Sprat','Sand smelt','Two-spotted goby','Fifteen-spined stickleback','Sand goby','Butterfish','Pollack','Poor cod');
link('Great cormorant','Sprat','Sand smelt','Corkwing wrasse','Goldsinny wrasse','Flounder','Plaice','Red mullet','Ballan wrasse','Saithe','Whiting','European sea bass');

// completeness pass: give the mid + benthic species their own prey, and close the
// loop upward so nothing is left as a dead-end (verified against each diet below).
link('Whiting','Sprat','Sand smelt','Sand goby','Common goby');          // whiting: small fish
link('Bib','Sprat','Shore Crab'); link('Poor cod','Plankton','Shore Crab'); // small gadoids: crustaceans/plankton
link('Dragonet','Seabed biodeposits','Common Brittlestar'); link('Spotted dragonet','Seabed biodeposits');
link('Red mullet','Seabed biodeposits','Common Brittlestar');            // barbel-feeder on benthic inverts
link('Shanny','Seabed biodeposits'); link('Rock goby','Seabed biodeposits');
link('Corkwing wrasse','Kelp canopy'); link('Goldsinny wrasse','Kelp canopy'); // pick inverts off the weed
link('Cuckoo wrasse','Spider Crab','Hermit Crab','Common Brittlestar');
link('Fifteen-spined stickleback','Plankton');
link('Grey gurnard','Sand goby'); link('Tub gurnard','Sand goby','Common goby');
link('Atlantic cod','Grey gurnard','Streaked gurnard','Red gurnard','Dragonet','Rock goby','Atlantic Bobtail');
link('Lesser-spotted catshark','Atlantic Bobtail','Common goby','Dragonet','Spotted dragonet');
link('Conger eel','Rock goby','Sand goby','Long-spined sea scorpion');
link('European sea bass','Sand goby'); link('Great cormorant','Rock goby','Grey gurnard');
link('Grey seal','Tub gurnard','Red gurnard','Bib'); link('European shag','Rock goby','Common goby');
link('Atlantic cod','Cuckoo wrasse'); link('Conger eel','Cuckoo wrasse');
link('Great cormorant','Cuckoo wrasse','Thick-lipped mullet'); link('Grey seal','Cuckoo wrasse','Thick-lipped mullet');
link('European sea bass','Thick-lipped mullet');
// remaining terminals (nothing in the catalogue eats them) are ecologically fair:
// the 5 apex predators, the 4 jellyfish, the two large starfish and the cushion star.
// accuracy additions found during the verification sweep (all real, well-documented):
link('Atlantic mackerel','Sprat'); link('Atlantic horse mackerel','Sprat'); // pelagic piscivory on small fish
link('Ballan wrasse','Farmed mussels');                                       // wrasse crush mussels (raid the ropes)
link('Common eider','Shore Crab','Dog Whelk','Spider Crab','Green sea urchin'); // eider: crabs, whelks, urchins (all documented)
link('Common Cuttlefish','Sprat');                                            // cuttlefish take small fish, not just crabs
link('Conger eel','Common Cuttlefish');                                       // conger take cuttlefish/squid too
// verification sweep 2: these three survive the no-farm baseline, so they must have
// non-farm food as well (each is a documented detritus feeder / generalist scavenger).
link('Thick-lipped mullet','Seabed biodeposits');   // mullet graze surface sediment & its organic film
link('Spider Crab','Seabed biodeposits');           // spider crabs scavenge & browse benthic material
link('Edible Crab','Seabed biodeposits','Shore Crab'); // generalist predator/scavenger, takes smaller crabs

const NAMES = new Set(SPECIES.map(s=>s.name));
const valid = new Set([...NAMES, ...Object.keys(RES)]);
const bad = E.filter(([a,b])=>!valid.has(a)||!valid.has(b));
if(bad.length){ console.error('BAD EDGES:', bad); throw new Error('edge endpoint(s) not found'); }
for(const s of SPECIES) if(!FORMS[s.form]) throw new Error('missing form '+s.form);

// dedupe identical edges, then report the directed web for a manual sanity check
{ const seen=new Set(); for(let i=E.length-1;i>=0;i--){ const k=E[i][0]+'>'+E[i][1]; if(seen.has(k)) E.splice(i,1); else seen.add(k); } }
{ const eats={},eaten={}; for(const [a,b] of E){ (eats[b]??=[]).push(a); (eaten[a]??=[]).push(b); }
  const noFood=SPECIES.filter(s=>!eats[s.name]).map(s=>s.short);
  const noPred=SPECIES.filter(s=>!eaten[s.name]).map(s=>s.short);
  const orphan=SPECIES.filter(s=>!eats[s.name]&&!eaten[s.name]).map(s=>s.name);
  console.log('edges:',E.length);
  console.log('eats-nothing-in-set ('+noFood.length+'):', noFood.join(', ')||'none');
  console.log('eaten-by-nothing-in-set ('+noPred.length+'):', noPred.join(', ')||'none');
  if(orphan.length) console.warn('!! ORPHANS (no links at all):', orphan.join(', ')); }
if(process.env.DUMP){
  const T=Object.fromEntries(SPECIES.map(s=>[s.name,s.tier]));
  const tag=x=>T[x]!=null?`(T${T[x]})`:'(res)';
  const eats={},eaten={};
  for(const [a,b] of E){ (eats[b]??=[]).push(a); (eaten[a]??=[]).push(b); }
  console.log('\n===== DIETS: PREDATOR eats [prey] =====');
  Object.keys(eats).sort().forEach(p=>console.log(`\n${p} ${tag(p)} eats ${eats[p].length}:\n   ${eats[p].slice().sort().map(x=>x+tag(x)).join(', ')}`));
  console.log('\n===== EATEN BY: prey -> [predators] =====');
  [...SPECIES.map(s=>s.name)].sort().forEach(p=>console.log(`${p} ${tag(p)} <- ${(eaten[p]||[]).slice().sort().join(', ')||'(nothing)'}`));
  console.log('\n===== TROPHIC-DIRECTION FLAGS (prey tier > predator tier) =====');
  let flags=0; for(const [a,b] of E){ if(T[a]!=null&&T[b]!=null&&T[a]>T[b]){ console.log(`  ${a}(T${T[a]}) -> ${b}(T${T[b]})`); flags++; } }
  console.log(flags?`  ${flags} flag(s)`:'  none');
}

// ---- Geometry / layout ------------------------------------------------------
const CW=1680, TILE=78, USE=48, CAP=26, GAPX=18, ROWH=TILE+CAP+20, GRP=42, CHIP=36;
const LX=150;
const proxRank={core:0,footprint:1,passing:2};
const sortB=(list)=>list.sort((a,c)=>(proxRank[a.prox]-proxRank[c.prox])||(a.tier-c.tier)||a.short.localeCompare(c.short));
const pos={}; const bandBox={};

function place(list,x0,x1,top,maxc){
  const cx=(x0+x1)/2, rows=Math.ceil(list.length/maxc);
  list.forEach((s,i)=>{
    const r=Math.floor(i/maxc), row=list.slice(r*maxc,(r+1)*maxc), n=row.length, ci=i-r*maxc;
    const rowW=n*TILE+(n-1)*GAPX, sx=cx-rowW/2, x=sx+ci*(TILE+GAPX), ty=top+r*ROWH;
    s._x=x; s._y=ty; pos[s.name]={cx:x+TILE/2, cy:ty+TILE/2};
  });
  return {top, bottom:top+rows*ROWH, cx, rows};
}
const g = key=>sortB(SPECIES.filter(s=>s.zone===key));

let y=92;
bandBox.surface = place(g('surface'), LX, CW-24, y, 5);            y=bandBox.surface.bottom+GRP+CHIP;
const mussel = place(g('mussel'), LX, CW/2-16, y, 6);
const canopy = place(g('canopy'), CW/2+16, CW-24, y, 6);
bandBox.mussel=mussel; bandBox.canopy=canopy;                     y=Math.max(mussel.bottom,canopy.bottom)+GRP+CHIP;
bandBox.open = place(g('open'), LX, CW-24, y, 12);                 y=bandBox.open.bottom+GRP+CHIP;
bandBox.seabed = place(g('seabed'), 300, CW-40, y, 12);          y=bandBox.seabed.bottom+142;
const CH=y;

// resource chips, centred above their cluster in the gap
const resPos={
  'Farmed mussels':{x:mussel.cx, y:mussel.top-CHIP+2},
  'Kelp canopy':{x:canopy.cx, y:canopy.top-CHIP+2},
  'Plankton':{x:bandBox.open.cx+430, y:bandBox.open.top-CHIP+2},
  'Seabed biodeposits':{x:bandBox.seabed.cx, y:bandBox.seabed.top-CHIP+2},
};
for(const [k,p] of Object.entries(resPos)) pos[k]={cx:p.x, cy:p.y+16};

// ---- Colours (colourblind-safe ordered ramp) --------------------------------
const TIER={2:'#63AEB5',3:'#2E8C9E',4:'#2A6394',5:'#26324E'};
const TIERLABEL={2:'Grazers and filter feeders',3:'Planktivores and invertivores',4:'Predators',5:'Apex predators'};

// ---- helpers ----------------------------------------------------------------
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;').replace(/"/g,'&quot;');
const idOf=s=>s.replace(/[^a-z0-9]+/gi,'_');
function edgePath(a,b){
  const p=pos[a],q=pos[b]; if(!p||!q) return '';
  const mx=(p.cx+q.cx)/2,my=(p.cy+q.cy)/2,dx=q.cx-p.cx,dy=q.cy-p.cy;
  const off=Math.min(55,Math.hypot(dx,dy)*0.16),nx=-dy,ny=dx,L=Math.hypot(nx,ny)||1;
  return `M${p.cx.toFixed(1)} ${p.cy.toFixed(1)} Q${(mx+nx/L*off).toFixed(1)} ${(my+ny/L*off).toFixed(1)} ${q.cx.toFixed(1)} ${q.cy.toFixed(1)}`;
}
function caption(w){
  const cx=TILE/2,y0=TILE+15;
  if(w.length<=13) return `<text class="cap" x="${cx}" y="${y0}">${esc(w)}</text>`;
  const parts=w.split(' ');let a='',b='';
  for(const p of parts){ if((a+' '+p).trim().length<=13&&!b) a=(a+' '+p).trim(); else b=(b+' '+p).trim(); }
  if(!b){b=a.slice(Math.ceil(a.length/2));a=a.slice(0,Math.ceil(a.length/2));}
  return `<text class="cap" x="${cx}" y="${y0-6}">${esc(a)}</text><text class="cap" x="${cx}" y="${y0+7}">${esc(b)}</text>`;
}

// ---- tiles ------------------------------------------------------------------
const tiles = SPECIES.map(s=>{
  const c=TIER[s.tier];
  const prox = s.prox==='core'
    ? `<circle cx="${TILE-13}" cy="13" r="5" fill="#2E8C9E"/>`
    : s.prox==='footprint'
    ? `<circle cx="${TILE-13}" cy="13" r="5" fill="none" stroke="#2E8C9E" stroke-width="2"/>`
    : `<circle cx="${TILE-13}" cy="13" r="4.5" fill="none" stroke="#90a0ae" stroke-width="1.3" stroke-dasharray="2 2"/>`;
  const farm=farmOf(s.name);
  const hbadge = farm==='harmed' ? `<g class="hbadge"><circle cx="14" cy="14" r="9" fill="#2E8C9E"/><path d="M14 9.5 L18.5 16.5 L9.5 16.5 Z" fill="#fff"/></g>` : '';
  return `<g class="tile" data-id="${idOf(s.name)}" data-farm="${farm}" transform="translate(${s._x} ${s._y})" tabindex="0" role="listitem" aria-label="${esc(s.name)}. ${TIERLABEL[s.tier]}. ${s.prox==='core'?'Farm core':s.prox==='footprint'?'Farm footprint':'Passing through'}.">
    <rect class="card" width="${TILE}" height="${TILE}" rx="12"/>
    <rect width="${TILE}" height="5" rx="2.5" fill="${c}"/>
    <use href="#f-${s.form}" x="${(TILE-USE)/2}" y="14" width="${USE}" height="${USE}" style="color:${c}"/>
    <g class="chip"><rect x="6" y="${TILE-18}" width="21" height="13" rx="3.5"/><text x="16.5" y="${TILE-8}">T${s.tier}</text></g>
    ${prox}${hbadge}${caption(s.short)}
  </g>`;
}).join('\n');

const resNodes = Object.entries(RES).map(([k,r])=>{
  const p=resPos[k];
  return `<g class="res" data-id="${idOf(k)}" data-farm="${r.farm}" tabindex="0" role="listitem" aria-label="${esc(r.label)}. Energy source.">

    <rect x="${p.x-78}" y="${p.y}" width="156" height="32" rx="9"/>
    <rect x="${p.x-78}" y="${p.y}" width="5" height="32" rx="2.5" fill="${r.col}"/>
    <text class="rlab" x="${p.x-66}" y="${p.y+14}">${esc(r.label)}</text>
    <text class="rsub" x="${p.x-66}" y="${p.y+26}">${esc(r.sub)}</text>
  </g>`;
}).join('\n');

const edges = E.map(([a,b])=>`<path class="edge" data-a="${idOf(a)}" data-b="${idOf(b)}" d="${edgePath(a,b)}" marker-end="url(#ah)"/>`).join('\n');

// ---- farm scene (rebuild of the Biodiversity Mechanisms diagram) ------------
const surfaceY=58, floorY=bandBox.seabed.top-18;      // sand line just above the benthos
const footTop=bandBox.seabed.bottom;                  // open sand strip below the benthos
const reefY=footTop+56;
const anchorLx=150, anchorRx=CW-150;
// mussel dropper lines under the LEFT (mussel) cluster
const mLines=[]; const mX0=225, mX1=CW/2-140, mN=6;
for(let i=0;i<mN;i++){ const x=mX0+i*(mX1-mX0)/(mN-1), top=surfaceY+4, bot=bandBox.mussel.bottom-6, nb=Math.round((bot-top)/22);
  let beads=''; for(let k=0;k<nb;k++){ const by=top+10+k*((bot-top-14)/(nb-1)); beads+=`<ellipse class="mussel" cx="${(x+(k%2?3:-3)).toFixed(1)}" cy="${by.toFixed(1)}" rx="7" ry="10"/>`; }
  mLines.push(`<line x1="${x.toFixed(1)}" y1="${surfaceY}" x2="${x.toFixed(1)}" y2="${top}" class="rope"/>${beads}`);
}
// seaweed fronds under the RIGHT (canopy) cluster
const fronds=[]; const fX0=CW/2+80, fX1=CW-150, fN=9;
for(let i=0;i<fN;i++){ const x=fX0+i*(fX1-fX0)/(fN-1), yt=surfaceY+2, yb=bandBox.canopy.top-6;
  fronds.push(`<path class="frond" opacity="0.8" d="M${x-6} ${yt} C${x-22} ${(yt+yb)*0.4} ${x+18} ${(yt+yb)*0.55} ${x-4} ${yb} C${x-16} ${(yt+yb)*0.55} ${x+14} ${(yt+yb)*0.4} ${x+6} ${yt} Z"/>`); }
// buoys along the headline
let buoys=''; for(let i=0;i<11;i++){ const x=120+i*(CW-240)/10; buoys+=`<line x1="${x}" y1="${surfaceY-12}" x2="${x}" y2="${surfaceY}" class="rope"/><circle class="buoy" cx="${x}" cy="${surfaceY-16}" r="8"/>`; }
// settlement blobs on the open sand footer
let blobs=''; for(let i=0;i<24;i++){ const x=440+i*40+((i*53)%36), yb=reefY-6+((i*29)%14), tan=i%3===0; blobs+=`<ellipse class="${tan?'blob-t':'blob-n'}" cx="${x}" cy="${yb}" rx="${8+(i%3)*3}" ry="6.5" opacity="0.9"/>`; }

// base layer (always shown): water, waterline, sand floor
const sceneBase = `
  <rect x="0" y="0" width="${CW}" height="${CH}" fill="url(#water)"/>
  <text x="16" y="${surfaceY-6}" fill="#6f8493" font-size="13" font-style="italic">surface</text>
  <line x1="0" y1="${surfaceY}" x2="${CW}" y2="${surfaceY}" class="waterline"/>
  <path d="M0 ${floorY} Q${CW/2} ${floorY-12} ${CW} ${floorY} L${CW} ${CH} L0 ${CH} Z" fill="url(#bed)"/>
  <line x1="0" y1="${floorY}" x2="${CW}" y2="${floorY}" class="sand-line"/>
  <text x="16" y="${floorY+16}" fill="#6f8493" font-size="13" font-style="italic">seabed</text>
`;
// farm layer (hidden in the "without the farm" view): structure, ropes, kelp, reef
const sceneFarm = `
  <line x1="120" y1="${surfaceY-16}" x2="${CW-120}" y2="${surfaceY-16}" class="rope"/>
  ${buoys}
  <line x1="200" y1="${surfaceY-16}" x2="${anchorLx}" y2="${floorY-4}" class="rope"/>
  <line x1="${CW-200}" y1="${surfaceY-16}" x2="${anchorRx}" y2="${floorY-4}" class="rope"/>
  <g>${mLines.join('')}</g>
  <g>${fronds.join('')}</g>
  <rect class="reef" x="400" y="${reefY-7}" width="${CW-800}" height="14" rx="7" opacity="0.5"/>
  ${blobs}
  <g class="blob-n" opacity="0.92"><ellipse cx="${anchorLx}" cy="${floorY+12}" rx="16" ry="11"/><ellipse class="blob-t" cx="${anchorLx-16}" cy="${floorY+16}" rx="10" ry="8"/><ellipse class="blob-t" cx="${anchorLx+16}" cy="${floorY+18}" rx="10" ry="8"/></g>
  <g class="blob-n" opacity="0.92"><ellipse cx="${anchorRx}" cy="${floorY+12}" rx="16" ry="11"/><ellipse class="blob-t" cx="${anchorRx-16}" cy="${floorY+16}" rx="10" ry="8"/><ellipse class="blob-t" cx="${anchorRx+16}" cy="${floorY+18}" rx="10" ry="8"/></g>
`;

// (The tan "canopy rain-down / mussel drop" beams were removed. Those two
//  subsidy mechanisms are still shown by the numbered callouts below and by the
//  feeding links out of the Kelp, Farmed-mussels and Seabed-biodeposits nodes.)

// ---- their three biodiversity-mechanism callouts (1 / 2 / 3) ----------------
const callouts = `
  <g class="callout"><rect x="${CW-424}" y="${surfaceY+44}" width="336" height="46" rx="8"/><text class="cnum" x="${CW-408}" y="${surfaceY+68}">2 &middot; Canopy habitat</text><text class="csub" x="${CW-408}" y="${surfaceY+84}">nursery &amp; shelter (variable due to harvesting)</text></g>
  <g class="callout"><rect x="${CW*0.5-168}" y="${footTop+12}" width="336" height="44" rx="8"/><text class="cnum" x="${CW*0.5-152}" y="${footTop+34}">1 &middot; Settlement &amp; drop-down</text><text class="csub" x="${CW*0.5-152}" y="${footTop+50}">shed material builds a small benthic reef</text></g>
  <g class="callout"><rect x="70" y="${footTop+74}" width="322" height="44" rx="8"/><text class="cnum" x="86" y="${footTop+96}">3 &middot; Artificial reef</text><text class="csub" x="86" y="${footTop+112}">anchors &amp; ropes host shellfish, kelp &amp; fish</text></g>
`;

// ---- band titles (in open margins, no sub-text to avoid collisions) ---------
const bandLabels = [
  ['Surface', LX-108, bandBox.surface.top+30, 'start', false],
  ['Mussel lines', 20, bandBox.mussel.top-13, 'start', true],
  ['Seaweed canopy', CW-24, bandBox.canopy.top-13, 'end', true],
  ['Open water', 20, bandBox.open.top-13, 'start', false],
  ['Seabed', 20, bandBox.seabed.top-13, 'start', false],
].map(([t,x,yy,anc,fb])=>`<text class="bt${fb?' farm-band':''}" x="${x}" y="${yy}" text-anchor="${anc}">${esc(t)}</text>`).join('\n');

// ---- directed page data (prey -> predator) ---------------------------------
const EDIR = E.map(([a,b])=>[idOf(a), idOf(b)]);
const NAMEBY={}, TIERBY={};
for(const s of SPECIES){ const i=idOf(s.name); NAMEBY[i]=s.name; TIERBY[i]=`${TIERLABEL[s.tier]} (T${s.tier})`; }
for(const k of Object.keys(RES)){ const i=idOf(k); NAMEBY[i]=RES[k].label; TIERBY[i]='Energy source'; }
const legendTiers = Object.keys(TIER).map(t=>`<span class="lg"><span class="sw" style="background:${TIER[t]}"></span>T${t} &middot; ${TIERLABEL[t]}</span>`).join('');

// ---- farm-impact page data (drives the with/without-farm toggle) ------------
const CREATED_IDS = [
  ...SPECIES.filter(s=>farmOf(s.name)==='created').map(s=>idOf(s.name)),
  ...Object.keys(RES).filter(k=>RES[k].farm==='created').map(k=>idOf(k)),
];
const createdSet = new Set(CREATED_IDS);
const createdSpeciesN = SPECIES.filter(s=>farmOf(s.name)==='created').length;
const enhancedN = SPECIES.filter(s=>farmOf(s.name)==='enhanced').length;
const harmedN = SPECIES.filter(s=>farmOf(s.name)==='harmed').length;
const baseSpeciesN = SPECIES.length - createdSpeciesN;
const baseLinks = EDIR.filter(([a,b])=>!createdSet.has(a)&&!createdSet.has(b)).length;
console.log(`FARM IMPACT: created ${createdSpeciesN}, enhanced ${enhancedN}, harmed ${harmedN} | with-farm ${SPECIES.length}sp/${E.length}lk -> baseline ${baseSpeciesN}sp/${baseLinks}lk`);

const body = `<div class="wrap" data-mode="farm">
  <header>
    <p class="eyebrow">PEBL &middot; FishSpotter &middot; biodiversity mechanisms</p>
    <h1>The food web of a seaweed &amp; shellfish farm</h1>
    <p class="stand">All <strong>${SPECIES.length} species</strong> in the FishSpotter catalogue, joined to what they eat and what eats them. Toggle the farm on and off to see how much of this web the seaweed and shellfish actually build, and click any species to trace its links.</p>
    <div class="controls">
      <div class="toggle" role="tablist" aria-label="Farm present or absent">
        <button class="tg active" type="button" data-set="farm" role="tab" aria-selected="true">With the farm</button>
        <button class="tg" type="button" data-set="baseline" role="tab" aria-selected="false">Without the farm</button>
      </div>
      <p class="modestat"><span class="ms-sp"></span> &middot; <span class="ms-lk"></span></p>
    </div>
    <p class="explain" data-for="farm">The farm gives a bare seabed four things it lacks: <strong>hard structure</strong> (an artificial reef of ropes, floats and anchors), a <strong>kelp-canopy nursery</strong>, a rain of <strong>detritus and mussel biodeposits</strong> that enriches the seabed, and a standing crop of <strong>mussels</strong> as food. Together they let reef fish, wrasse, blennies, urchins, snails and shellfish-eaters colonise a patch of open sand.</p>
    <p class="explain" data-for="baseline">Strip the farm away and the site is bare soft sediment and open water. The structure, kelp and mussels are gone, and with them <strong>${createdSpeciesN} reef, weed and shellfish specialists</strong> that only the farm supports (ghosted); <strong>${enhancedN} more</strong> thin out (faded). What remains is the natural sand-and-open-water community, plus clean-sand animals like the sea potato (marked <span class="plus-inline">+</span>) that the biodeposits had been suppressing. The gap between the two views is the biodiversity the farm creates.</p>
    <div class="keys">
      <div class="keyrow">${legendTiers}</div>
      <div class="keyrow">
        <span class="lg"><span class="dot core"></span>Farm-core</span>
        <span class="lg"><span class="dot foot"></span>Footprint (enriched seabed)</span>
        <span class="lg"><span class="dot pass"></span>Passing through</span>
        <span class="lg"><span class="sw" style="background:#2A6394"></span>Click a tile: blue = its prey</span>
        <span class="lg"><span class="sw" style="background:#B5762E"></span>amber = its predators</span>
      </div>
      <div class="keyrow baseline-key">
        <span class="lg"><span class="ghost-key"></span>Gone without the farm</span>
        <span class="lg"><span class="fade-key"></span>Fewer without the farm</span>
        <span class="lg"><span class="plus-key">+</span>More abundant without the farm</span>
      </div>
    </div>
  </header>
  <div class="scene" role="list" aria-label="Farm food web">
    <svg viewBox="0 0 ${CW} ${CH}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef3f6"/><stop offset="1" stop-color="#e2eaef"/></linearGradient>
        <linearGradient id="bed" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ece3cf"/><stop offset="1" stop-color="#ddd2b6"/></linearGradient>
        <marker id="ah" markerWidth="8" markerHeight="8" refX="6.5" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 L2.4 4 Z" fill="#2E8C9E"/></marker>
      </defs>
      <g class="silhouette-sprite" style="position:absolute" aria-hidden="true">${SPRITE}</g>
      ${sceneBase}
      <g class="farm-only">${sceneFarm}${callouts}</g>
      ${bandLabels}
      <g class="edges">${edges}</g>
      ${resNodes}
      <g class="tiles">${tiles}</g>
    </svg>
  </div>
  <aside class="infocard" hidden role="dialog" aria-label="Species connections">
    <div class="ic-head"><span class="ic-name"></span><button class="ic-close" type="button" aria-label="Clear selection">Clear</button></div>
    <div class="ic-tier"></div>
    <div class="ic-sec ic-eats"><b>Eats <span class="ic-eats-n"></span></b><div class="ic-eats-list"></div></div>
    <div class="ic-sec ic-eaten"><b>Eaten by <span class="ic-eaten-n"></span></b><div class="ic-eaten-list"></div></div>
    <p class="ic-hint">Tap a name to jump to it. Esc or Clear to reset.</p>
  </aside>
  <footer>
    <p>Rebuilt from PEBL's Biodiversity Mechanisms diagram and the live <code>species-traits.json</code> catalogue. Trophic placement and farm-impact are indicative, drawn from published UK / NE-Atlantic diet records and shellfish- &amp; seaweed-aquaculture ecology (artificial-reef, canopy-nursery and biodeposition studies): a teaching schematic, not a quantified survey. <span class="count">${SPECIES.length} species &middot; ${E.length} feeding links with the farm</span></p>
  </footer>
</div>
<script>
  const EDIR=${JSON.stringify(EDIR)};        // [preyId, predatorId]
  const NAME=${JSON.stringify(NAMEBY)};
  const TIERN=${JSON.stringify(TIERBY)};
  const CREATED=new Set(${JSON.stringify(CREATED_IDS)});   // absent without the farm
  const STAT={farm:{sp:${SPECIES.length},lk:${E.length}},baseline:{sp:${baseSpeciesN},lk:${baseLinks}}};
  const EATS={}, EATEN={};                    // EATS[x] = what x eats; EATEN[x] = what eats x
  for(const [a,b] of EDIR){ (EATS[b]??=[]).push(a); (EATEN[a]??=[]).push(b); }
  const NAME2ID={}; for(const k in NAME) NAME2ID[NAME[k]]=k;
  const wrap=document.querySelector('.wrap');
  const scene=document.querySelector('.scene');
  const card=document.querySelector('.infocard');
  const byId={}; document.querySelectorAll('.tile,.res').forEach(n=>byId[n.dataset.id]=n);
  let locked=null;
  const mode=()=>wrap.dataset.mode;
  const present=id=> mode()==='farm' || !CREATED.has(id);
  function reset(){ document.querySelectorAll('.sel,.prey,.pred,.on').forEach(n=>n.classList.remove('sel','prey','pred','on')); }
  function paint(id){
    reset(); scene.classList.add('focusing');
    if(byId[id]) byId[id].classList.add('sel');
    (EATS[id]||[]).filter(present).forEach(p=>byId[p]&&byId[p].classList.add('prey'));
    (EATEN[id]||[]).filter(present).forEach(p=>byId[p]&&byId[p].classList.add('pred'));
    document.querySelectorAll('.edge').forEach(e=>{ if((e.dataset.a===id||e.dataset.b===id)&&present(e.dataset.a)&&present(e.dataset.b)) e.classList.add('on'); });
  }
  function chips(ids){
    if(!ids||!ids.length) return '';
    return ids.map(x=>NAME[x]).sort((a,b)=>a.localeCompare(b))
      .map(n=>'<button class="ic-lnk" type="button" data-n="'+n.replace(/"/g,'&quot;')+'">'+n+'</button>').join('');
  }
  function panel(id){
    const isRes = TIERN[id]==='Energy source';
    const eats=(EATS[id]||[]).filter(present), eaten=(EATEN[id]||[]).filter(present);
    card.querySelector('.ic-name').textContent=NAME[id];
    card.querySelector('.ic-tier').textContent=TIERN[id]||'';
    card.querySelector('.ic-eats-n').textContent='('+eats.length+')';
    card.querySelector('.ic-eaten-n').textContent='('+eaten.length+')';
    card.querySelector('.ic-eats-list').innerHTML = eats.length? chips(eats) : '<span class="ic-none">'+(isRes?'an energy input, not a consumer':'nothing here')+'</span>';
    card.querySelector('.ic-eaten-list').innerHTML = eaten.length? chips(eaten) : '<span class="ic-none">top of this web here</span>';
    card.hidden=false;
  }
  function select(id){ if(!present(id)) return; locked=id; paint(id); panel(id); }
  function clearAll(){ locked=null; scene.classList.remove('focusing'); reset(); card.hidden=true; }
  document.querySelectorAll('.tile,.res').forEach(el=>{
    const id=el.dataset.id;
    el.addEventListener('click',e=>{ e.stopPropagation(); if(!present(id)) return; (locked===id)?clearAll():select(id); });
    el.addEventListener('mouseenter',()=>{ if(!locked&&present(id)) paint(id); });
    el.addEventListener('keydown',e=>{ if((e.key==='Enter'||e.key===' ')&&present(id)){ e.preventDefault(); (locked===id)?clearAll():select(id); } });
  });
  scene.addEventListener('mouseleave',()=>{ if(!locked){ scene.classList.remove('focusing'); reset(); } });
  card.addEventListener('click',e=>{
    e.stopPropagation();
    if(e.target.closest('.ic-close')) return clearAll();
    const lnk=e.target.closest('.ic-lnk'); if(lnk){ const id=NAME2ID[lnk.dataset.n]; if(id&&present(id)){ select(id); const t=byId[id]; if(t&&t.scrollIntoView) t.scrollIntoView({block:'center',behavior:'smooth'}); } }
  });
  document.addEventListener('click',e=>{ if(!e.target.closest('.tile,.res,.infocard,.toggle')) clearAll(); });
  window.addEventListener('keydown',e=>{ if(e.key==='Escape') clearAll(); });
  // ---- with / without farm toggle ----
  function setMode(m){
    wrap.dataset.mode=m;
    document.querySelectorAll('.tg').forEach(b=>{ const on=b.dataset.set===m; b.classList.toggle('active',on); b.setAttribute('aria-selected',on?'true':'false'); });
    document.querySelectorAll('.edge').forEach(e=>{ e.classList.toggle('edge-off', m==='baseline' && (CREATED.has(e.dataset.a)||CREATED.has(e.dataset.b))); });
    document.querySelector('.ms-sp').textContent = STAT[m].sp+' species at the site'+(m==='baseline'?' ('+${createdSpeciesN}+' lost, '+${enhancedN}+' reduced)':'');
    document.querySelector('.ms-lk').textContent = STAT[m].lk+' feeding links';
    clearAll();
  }
  document.querySelectorAll('.tg').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.set)));
  setMode('farm');
</script>`;

// Only write when run directly (`node food-web/build-foodweb.mjs`), so verify.mjs
// can import the data without rewriting the committed page.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if(isMain){
  const css = readFileSync(new URL('./foodweb.css', import.meta.url),'utf8');
  writeFileSync(OUT, `<style>${css}</style>\n${body}`);
  console.log('wrote', OUT, '·', SPECIES.length,'species,',E.length,'edges, canvas',CW+'x'+Math.round(CH));
}
