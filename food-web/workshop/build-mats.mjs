// Draw the finished A1 mat for each workshop table — cards in their zones and
// every arrow drawn — and inject the SVGs into guide.html between <!--MATn-->
// markers.
//
// The layout (where each card sits) is hand-authored below, because a force
// layout produces an unreadable tangle at this size. The ARROWS are not: they
// are taken from the real food-web edge list, and the script refuses to emit a
// mat whose drawn arrows differ from the derived set by even one link. That is
// what stops the answer sheet quietly going stale after a re-grade.
//
//   node food-web/workshop/build-mats.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { RES, E, farmOf } from '../build-foodweb.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const GUIDE = join(HERE, 'guide.html');

const W = 560, H = 252;
const SURFACE_Y = 44, SEABED_Y = 196;      // zone boundaries
const CW = 52, CH = 21;                     // card box
const RW = 82, RH = 15;                     // printed resource chip

// short display names for the boxes
const SHORT = {
  'Common Limpet': 'limpet', 'Painted Top Shell': 'painted|top shell', 'Edible sea urchin': 'edible|sea urchin',
  'Two-spotted goby': '2-spotted|goby', 'Ballan wrasse': 'ballan|wrasse', 'Spider Crab': 'spider crab',
  'Thick-lipped mullet': 'thick-lipped|mullet', 'Great cormorant': 'cormorant',
  'Dog Whelk': 'dog whelk', 'Velvet Swimming Crab': 'velvet|swim. crab', 'Spiny Starfish': 'spiny|starfish',
  'Common Starfish': 'common|starfish', 'Common Brittlestar': 'brittlestar', 'Shore Crab': 'shore crab',
  'Edible Crab': 'edible crab', 'Common eider': 'eider',
  'Sprat': 'sprat', 'Sand smelt': 'sand smelt', 'Fifteen-spined stickleback': '15-spined|stickleback',
  'Poor cod': 'poor cod', 'Bib': 'bib', 'Pollack': 'pollack', 'Atlantic cod': 'Atlantic cod',
  'European shag': 'shag',
  'Hermit Crab': 'hermit crab', 'Butterfish': 'butterfish', 'Shanny': 'shanny', 'Rock goby': 'rock goby',
  'Common Octopus': 'common|octopus', 'Conger eel': 'conger eel', 'Lesser-spotted catshark': 'catshark',
  'Grey seal': 'grey seal',
  'Sea potato': 'sea potato', 'Purple heart urchin': 'purple|heart urchin', 'Dragonet': 'dragonet',
  'Sand goby': 'sand goby', 'Long-spined sea scorpion': 'sea scorpion', 'Plaice': 'plaice',
  'Flounder': 'flounder', 'Harbour seal': 'harbour seal',
};
const RESSHORT = {
  'Kelp canopy': 'KELP', 'Farmed mussels': 'FARMED MUSSELS', 'Plankton': 'PLANKTON',
  'Seabed biodeposits': 'DETRITUS ON SEABED',
};
const BADGE = { created: '●', enhanced: '◑', anyway: '○', harmed: '✦' };
const CIRCLED = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨'];

// ---- per-table layout: card + chip centres, and the grouped arrows ----------
const TABLES = {
  1: {
    res: { 'Plankton': [210, 60], 'Farmed mussels': [80, 116], 'Kelp canopy': [498, 186], 'Seabed biodeposits': [168, 228] },
    cards: {
      'Great cormorant': [268, 20], 'Thick-lipped mullet': [98, 64], 'Two-spotted goby': [320, 86],
      'Ballan wrasse': [396, 108], 'Common limpet': [410, 168], 'Painted Top Shell': [490, 150],
      'Edible sea urchin': [524, 110], 'Spider Crab': [300, 224],
    },
    groups: [
      { why: 'The three grazers all eat the seaweed itself, or the algal film growing on it.',
        pairs: [['Kelp canopy','Common Limpet'],['Kelp canopy','Painted Top Shell'],['Kelp canopy','Edible sea urchin']] },
      { why: 'Browses the weed and scavenges what has fallen. Two arrows in, which is what saves it.',
        pairs: [['Kelp canopy','Spider Crab'],['Seabed biodeposits','Spider Crab']] },
      { why: 'Sieves the organic film off both the weed and the sediment surface.',
        pairs: [['Kelp canopy','Thick-lipped mullet'],['Seabed biodeposits','Thick-lipped mullet']] },
      { why: 'A planktivore, despite living against the weed.',
        pairs: [['Plankton','Two-spotted goby']] },
      { why: 'On every mat. The mussels filter plankton, which is why a farm adds no food to the sea.',
        pairs: [['Plankton','Farmed mussels']] },
      { why: 'Five arrows into one fish. Its throat teeth crush shell, so almost everything here is on its menu.',
        pairs: [['Common Limpet','Ballan wrasse'],['Painted Top Shell','Ballan wrasse'],['Edible sea urchin','Ballan wrasse'],['Spider Crab','Ballan wrasse'],['Farmed mussels','Ballan wrasse']] },
      { why: 'The bird takes the two biggest fish on the table.',
        pairs: [['Ballan wrasse','Great cormorant'],['Thick-lipped mullet','Great cormorant']] },
    ],
  },
  2: {
    res: { 'Plankton': [150, 58], 'Farmed mussels': [150, 120], 'Kelp canopy': [470, 62], 'Seabed biodeposits': [300, 226] },
    cards: {
      'Common eider': [240, 20], 'Common Starfish': [286, 112], 'Spiny Starfish': [240, 168],
      'Dog Whelk': [56, 170], 'Velvet Swimming Crab': [140, 182], 'Common Brittlestar': [432, 108],
      'Shore Crab': [178, 222], 'Edible Crab': [424, 222],
    },
    groups: [
      { why: 'On every mat, and here it is the start of everything: the mussels filter plankton.',
        pairs: [['Plankton','Farmed mussels']] },
      { why: 'Six separate arrows off one food source. This is why a farm concentrates life: a lot of food in a small space.',
        pairs: [['Farmed mussels','Dog Whelk'],['Farmed mussels','Common Starfish'],['Farmed mussels','Spiny Starfish'],['Farmed mussels','Velvet Swimming Crab'],['Farmed mussels','Edible Crab'],['Farmed mussels','Common eider']] },
      { why: 'It filters and deposit-feeds, taking whatever drifts past or settles. Three sources, so it is hard to starve.',
        pairs: [['Kelp canopy','Common Brittlestar'],['Plankton','Common Brittlestar'],['Seabed biodeposits','Common Brittlestar']] },
      { why: 'Both crabs scavenge the seabed. This is their non-farm food, and it is why they survive.',
        pairs: [['Seabed biodeposits','Shore Crab'],['Seabed biodeposits','Edible Crab']] },
      { why: "The starfish's other meal. This single arrow is the reason it stays on the table.",
        pairs: [['Common Brittlestar','Common Starfish']] },
      { why: 'Bigger crab eats smaller crab. People rarely expect this one.', bend: -30,
        pairs: [['Shore Crab','Edible Crab']] },
      { why: 'Eider take far more than mussels — crabs and whelks go down whole too.',
        pairs: [['Shore Crab','Common eider'],['Dog Whelk','Common eider']] },
    ],
  },
  3: {
    // nothing on this table lives on the bottom, so the seabed band is a thin
    // strip and the midwater fish get the room instead
    seabed: 228,
    res: { 'Plankton': [52, 140], 'Farmed mussels': [52, 206] },
    cards: {
      'European shag': [470, 22], 'Pollack': [370, 124], 'Atlantic cod': [370, 196], 'Bib': [262, 84],
      'Sprat': [150, 80], 'Sand smelt': [150, 140], 'Fifteen-spined stickleback': [150, 200],
      'Poor cod': [262, 200],
    },
    groups: [
      { why: 'Four planktivores feeding off the base of the chain. None of this depends on the farm.',
        pairs: [['Plankton','Sprat'],['Plankton','Sand smelt'],['Plankton','Fifteen-spined stickleback'],['Plankton','Poor cod']] },
      { why: 'On every mat. Here it makes the point that the mussels compete with the sprat for the same plankton.',
        pairs: [['Plankton','Farmed mussels']] },
      { why: 'Bib take small fish as well as crustaceans.',
        pairs: [['Sprat','Bib']] },
      { why: 'Four arrows into the pollack. It is the mid-water generalist and takes anything small enough.',
        pairs: [['Sprat','Pollack'],['Sand smelt','Pollack'],['Fifteen-spined stickleback','Pollack'],['Poor cod','Pollack']] },
      { why: 'Cod eat other gadoids quite happily, including their own smaller relatives.',
        pairs: [['Sprat','Atlantic cod'],['Poor cod','Atlantic cod'],['Bib','Atlantic cod']] },
      { why: 'Five arrows into the bird, including a full-grown pollack. This is how much a top predator leans on everything beneath it.',
        pairs: [['Sprat','European shag'],['Sand smelt','European shag'],['Fifteen-spined stickleback','European shag'],['Pollack','European shag'],['Poor cod','European shag']] },
    ],
  },
  4: {
    res: { 'Plankton': [58, 100], 'Farmed mussels': [178, 50], 'Seabed biodeposits': [250, 226] },
    cards: {
      'Grey seal': [300, 20], 'Common Octopus': [116, 124], 'Conger eel': [244, 124],
      'Lesser-spotted catshark': [444, 150], 'Rock goby': [58, 186], 'Butterfish': [150, 186],
      'Shanny': [240, 186], 'Hermit Crab': [332, 186],
    },
    groups: [
      { why: 'The rain-down from the farm — mussel waste, dropped shell, shredded weed — feeds the whole bottom layer.',
        pairs: [['Seabed biodeposits','Rock goby'],['Seabed biodeposits','Butterfish'],['Seabed biodeposits','Shanny'],['Seabed biodeposits','Hermit Crab']] },
      { why: 'It takes drifting food as well as picking the bottom, so it has two arrows in.',
        pairs: [['Plankton','Rock goby']] },
      { why: 'On every mat. The only arrow here with nothing to do with the seabed.',
        pairs: [['Plankton','Farmed mussels']] },
      { why: 'Octopus raid the ropes and open shellfish with a strong beak.',
        pairs: [['Farmed mussels','Common Octopus']] },
      { why: 'Both are crab specialists. The borrowed shell is no defence against a beak.',
        pairs: [['Hermit Crab','Common Octopus'],['Hermit Crab','Lesser-spotted catshark']] },
      { why: 'Five arrows into the conger. It ambushes anything passing the mouth of its hole, including a small shark.',
        pairs: [['Butterfish','Conger eel'],['Shanny','Conger eel'],['Rock goby','Conger eel'],['Common Octopus','Conger eel'],['Lesser-spotted catshark','Conger eel']] },
      { why: 'Seals take the three biggest animals on the table.',
        pairs: [['Conger eel','Grey seal'],['Lesser-spotted catshark','Grey seal'],['Common Octopus','Grey seal']] },
    ],
  },
  5: {
    res: { 'Plankton': [430, 66], 'Farmed mussels': [310, 66], 'Seabed biodeposits': [196, 226] },
    cards: {
      'Harbour seal': [300, 20], 'Plaice': [118, 122], 'Flounder': [232, 122],
      'Long-spined sea scorpion': [446, 152], 'Sea potato': [56, 186], 'Purple heart urchin': [148, 186],
      'Dragonet': [248, 186], 'Sand goby': [352, 186],
    },
    groups: [
      { why: 'Four cards feeding off the seabed directly. Note this food source is not farm-dependent — sand always has organic matter in it.',
        pairs: [['Seabed biodeposits','Sea potato'],['Seabed biodeposits','Purple heart urchin'],['Seabed biodeposits','Dragonet'],['Seabed biodeposits','Sand goby']] },
      { why: 'It takes drifting food too, giving it a second arrow.',
        pairs: [['Plankton','Sand goby']] },
      { why: "On every mat. The only arrow here that disappears at the reveal, along with the sea scorpion's.",
        pairs: [['Plankton','Farmed mussels']] },
      { why: 'Plaice crunch buried urchins — one of the few things that eats a sea potato.',
        pairs: [['Sea potato','Plaice'],['Purple heart urchin','Plaice']] },
      { why: 'Same again for the flounder.',
        pairs: [['Sea potato','Flounder']] },
      { why: 'The ambush predator’s meal, and the only card-to-card arrow lost at the reveal.',
        pairs: [['Sand goby','Long-spined sea scorpion']] },
      { why: 'Harbour seals work sandy ground and take flatfish.',
        pairs: [['Flounder','Harbour seal']] },
    ],
  },
};

// 'Common limpet' typo-guard: normalise any key that differs only by case
for (const t of Object.values(TABLES)) {
  for (const k of Object.keys(t.cards)) {
    if (!(k in SHORT)) {
      const hit = Object.keys(SHORT).find(s => s.toLowerCase() === k.toLowerCase());
      if (hit) { t.cards[hit] = t.cards[k]; delete t.cards[k]; }
    }
  }
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Clip a centre-to-centre segment back to the two boxes' edges. */
function clip(ax, ay, bx, by, ahw, ahh, bhw, bhh) {
  const dx = bx - ax, dy = by - ay;
  const t = (hw, hh) => {
    const tx = dx ? hw / Math.abs(dx) : Infinity;
    const ty = dy ? hh / Math.abs(dy) : Infinity;
    return Math.min(tx, ty);
  };
  const ta = t(ahw + 2, ahh + 2), tb = t(bhw + 4, bhh + 4);
  return [ax + dx * ta, ay + dy * ta, bx - dx * tb, by - dy * tb];
}

// A line crossing another line is normal in a food web and reads fine. A line
// passing THROUGH a third box does not — it looks like it connects to it. So
// bend each arrow just enough to miss every box it is not attached to, trying
// the smallest deflection first and keeping the straight line when it is clear.
const BENDS = [0, 11, -11, 18, -18, 26, -26, 34, -34, 44, -44, 56, -56];

function qpoint(x1, y1, cx, cy, x2, y2, t) {
  const u = 1 - t;
  return [u * u * x1 + 2 * u * t * cx + t * t * x2, u * u * y1 + 2 * u * t * cy + t * t * y2];
}

/** How many sampled points on this curve land inside a box we must avoid. */
function hits(x1, y1, cx, cy, x2, y2, boxes) {
  let n = 0;
  for (let i = 1; i < 24; i++) {
    const [px, py] = qpoint(x1, y1, cx, cy, x2, y2, i / 24);
    for (const b of boxes) {
      if (px > b.x - b.hw - 3 && px < b.x + b.hw + 3 && py > b.y - b.hh - 3 && py < b.y + b.hh + 3) { n++; break; }
    }
  }
  return n;
}

/** Pick the least-deflected route from A to B that misses every other box. */
function route(x1, y1, x2, y2, boxes) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;          // unit normal
  let best = null;
  for (const off of BENDS) {
    const cx = mx + nx * off * 2, cy = my + ny * off * 2;  // control pt (curve peaks at ~half)
    const h = hits(x1, y1, cx, cy, x2, y2, boxes);
    if (h === 0) return { cx, cy, off, clean: true };
    if (!best || h < best.h) best = { cx, cy, off, h, clean: false };
  }
  return best;
}

function buildMat(n, after = false) {
  const spec = TABLES[n];
  const nodes = {};
  for (const [k, [x, y]] of Object.entries(spec.res)) nodes[k] = { x, y, hw: RW / 2, hh: RH / 2, res: true };
  for (const [k, [x, y]] of Object.entries(spec.cards)) nodes[k] = { x, y, hw: CW / 2, hh: CH / 2 };

  // --- correctness gate: drawn arrows must equal the derived edge set --------
  const inScope = x => x in nodes;
  const derived = new Set(E.filter(([a, b]) => inScope(a) && inScope(b)).map(([a, b]) => a + '>' + b));
  const drawn = new Set();
  for (const g of spec.groups) for (const [a, b] of g.pairs) {
    if (!inScope(a) || !inScope(b)) throw new Error(`table ${n}: arrow endpoint not placed: ${a} -> ${b}`);
    drawn.add(a + '>' + b);
  }
  const missing = [...derived].filter(k => !drawn.has(k));
  const extra = [...drawn].filter(k => !derived.has(k));
  if (missing.length || extra.length) {
    throw new Error(`table ${n}: mat arrows do not match the food web\n  missing: ${missing.join(', ') || 'none'}\n  invented: ${extra.join(', ') || 'none'}`);
  }

  const sea = spec.seabed || SEABED_Y;
  const out = [];
  out.push(`<svg viewBox="0 0 ${W} ${H}" width="100%">`);
  out.push(`<defs><marker id="mh${n}" markerWidth="6.5" markerHeight="6.5" refX="5.6" refY="2.6" orient="auto"><path d="M0 0 L6 2.6 L0 5.2 z" fill="#000"/></marker></defs>`);
  // mat + zones
  out.push(`<rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="5" fill="#fff" stroke="#000" stroke-width="1.3"/>`);
  out.push(`<rect x="2" y="${sea}" width="${W - 4}" height="${H - 2 - sea}" fill="#ececec"/>`);
  out.push(`<line x1="2" y1="${SURFACE_Y}" x2="${W - 2}" y2="${SURFACE_Y}" stroke="#aaa" stroke-width="1"/>`);
  out.push(`<line x1="2" y1="${sea}" x2="${W - 2}" y2="${sea}" stroke="#aaa" stroke-width="1"/>`);
  out.push(`<text x="8" y="15" font-family="Helvetica" font-size="7.5" fill="#888" font-style="italic">surface</text>`);
  out.push(`<text x="8" y="${sea + 12}" font-family="Helvetica" font-size="7.5" fill="#888" font-style="italic">seabed</text>`);

  // in the "after" mat, farm-built cards and the two farm food sources are gone
  const dead = k => nodes[k].res
    ? (RES[k] && RES[k].farm === 'created')
    : farmOf(k) === 'created';
  const survives = ([a, b]) => !dead(a) && !dead(b);

  // arrows first, so boxes sit on top of the line ends
  let dirty = 0, alive = 0;
  spec.groups.forEach((g, gi) => {
    g.pairs.forEach(([a, b], pi) => {
      const A = nodes[a], B = nodes[b];
      const gone = after && !survives([a, b]);
      if (!gone) alive++;
      const [x1, y1, x2, y2] = clip(A.x, A.y, B.x, B.y, A.hw, A.hh, B.hw, B.hh);
      const others = Object.entries(nodes).filter(([k]) => k !== a && k !== b).map(([, v]) => v);
      const r = route(x1, y1, x2, y2, others);
      if (!r.clean && !after) dirty++;
      // a cut arrow is drawn faint + dashed, the way a table crosses it out
      const style = gone
        ? `stroke="#c0c0c0" stroke-width="0.9" stroke-dasharray="3 2.5"`
        : `stroke="#000" stroke-width="1.1" marker-end="url(#mh${n})"`;
      out.push(`<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} Q${r.cx.toFixed(1)} ${r.cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" ${style}/>`);
      if (pi === 0 && !after) { // one numbered tag per group, on its first arrow
        const [lx, ly] = qpoint(x1, y1, r.cx, r.cy, x2, y2, 0.45);
        out.push(`<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="5.6" fill="#fff" stroke="#000" stroke-width="1"/>`);
        out.push(`<text x="${lx.toFixed(1)}" y="${(ly + 2.4).toFixed(1)}" font-family="Helvetica" font-size="7" font-weight="bold" fill="#000" text-anchor="middle">${gi + 1}</text>`);
      }
    });
  });
  if (dirty) console.warn(`   table ${n}: ${dirty} arrow(s) could not be routed clear of a box`);

  // printed mat resources (rounded, grey, dashed = pre-printed on the A1)
  for (const [k, node] of Object.entries(nodes)) {
    if (!node.res) continue;
    const g = after && dead(k);
    out.push(`<rect x="${node.x - RW / 2}" y="${node.y - RH / 2}" width="${RW}" height="${RH}" rx="7" fill="${g ? '#f4f4f4' : '#e2e2e2'}" stroke="${g ? '#c4c4c4' : '#000'}" stroke-width="1" stroke-dasharray="3 2"/>`);
    out.push(`<text x="${node.x}" y="${node.y + 2.6}" font-family="Helvetica" font-size="6.2" font-weight="bold" fill="${g ? '#bbb' : '#000'}" text-anchor="middle">${esc(RESSHORT[k])}</text>`);
  }
  // species cards
  for (const [k, node] of Object.entries(nodes)) {
    if (node.res) continue;
    const g = after && dead(k);
    const ink = g ? '#bbb' : '#000';
    const lines = (SHORT[k] || k).split('|');
    out.push(`<rect x="${node.x - CW / 2}" y="${node.y - CH / 2}" width="${CW}" height="${CH}" rx="2.5" fill="${g ? '#f4f4f4' : '#fff'}" stroke="${g ? '#c4c4c4' : '#000'}" stroke-width="1.2"/>`);
    out.push(`<text x="${node.x - CW / 2 + 3.4}" y="${node.y - CH / 2 + 7.6}" font-family="Helvetica" font-size="7.4" fill="${ink}">${BADGE[farmOf(k)] || ''}</text>`);
    lines.forEach((ln, i) => {
      const y = node.y + (lines.length === 1 ? 6.2 : (i === 0 ? 1.4 : 8.6));
      out.push(`<text x="${node.x + 4}" y="${y}" font-family="Helvetica" font-size="6.6" fill="${ink}" text-anchor="middle">${esc(ln)}</text>`);
    });
    // the face-down cross, drawn over a dead card
    if (g) {
      const hx = CW / 2 - 5, hy = CH / 2 - 4;
      out.push(`<path d="M${node.x - hx} ${node.y - hy} L${node.x + hx} ${node.y + hy} M${node.x + hx} ${node.y - hy} L${node.x - hx} ${node.y + hy}" stroke="#c4c4c4" stroke-width="1"/>`);
    }
  }
  out.push(`</svg>`);

  // the numbered key that pairs with the drawing
  const key = spec.groups.map((g, i) =>
    `<tr><td class="ky">${CIRCLED[i]}</td><td>${g.why}</td></tr>`).join('\n    ');
  return { svg: out.join('\n'), key, arrows: drawn.size, alive };
}

let html = readFileSync(GUIDE, 'utf8');
let injected = 0;
for (const n of [1, 2, 3, 4, 5]) {
  const { svg, key, arrows } = buildMat(n);
  const block = `\n  <div class="sk">\n${svg}\n    <p class="cap">The finished mat for table ${n} &mdash; ${arrows} arrows. Numbers key to the list below. Dashed boxes are printed on the A1; solid boxes are the cards.</p>\n  </div>\n\n  <h3>The arrows, and why they exist</h3>\n  <table class="ms keytab">\n    ${key}\n  </table>\n`;
  const re = new RegExp(`(<!--MAT${n}-->)[\\s\\S]*?(<!--/MAT${n}-->)`);
  if (!re.test(html)) { console.warn(`!! no <!--MAT${n}--> marker in guide.html`); continue; }
  html = html.replace(re, `$1${block}  $2`);
  injected++;

  // the same mat after minute 24, for checking a table's work during the reveal
  const a = buildMat(n, true);
  const gone = arrows - a.alive;
  const aBlock = `\n  <h3>The same mat after the farm goes</h3>\n  <div class="sk mini">\n${a.svg}\n    <p class="cap">Table ${n} after the reveal &mdash; ${arrows} arrows down to ${a.alive}. Crossed boxes are face down, faint dashed lines are the ${gone} arrows the table crosses out.</p>\n  </div>\n`;
  const reA = new RegExp(`(<!--AFTER${n}-->)[\\s\\S]*?(<!--/AFTER${n}-->)`);
  if (reA.test(html)) html = html.replace(reA, `$1${aBlock}  $2`);
  else console.warn(`!! no <!--AFTER${n}--> marker in guide.html`);

  console.log(`table ${n}: ${arrows} arrows drawn (all matched); after the reveal ${a.alive} survive, ${gone} cut`);
}
writeFileSync(GUIDE, html);
console.log(`injected ${injected}/5 mats into guide.html`);
