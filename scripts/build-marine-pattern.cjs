#!/usr/bin/env node
/*
 * Builds a seamless, tileable marine-silhouette pattern SVG (WhatsApp-doodle
 * style) from the CC0 / Public-Domain PhyloPic silhouettes in
 * public/silhouettes/. Output: public/patterns/marine-pattern.svg.
 *
 * Technique: each silhouette becomes a <symbol> (preserving its own viewBox);
 * instances are scattered on a jittered grid and emitted as <use> elements.
 * Any instance near a tile edge is also emitted wrapped to the opposite edge
 * (toroidal), so the tile repeats seamlessly with `mask-repeat: repeat`.
 *
 * The shapes keep fill="currentColor", so the consuming element tints them via
 * `background-color: currentColor` through `mask-image` (same approach as
 * ShapeGate / UnderwaterBackdrop). Deterministic (seeded PRNG) so re-runs are
 * byte-stable.
 *
 * Re-run after adding silhouettes:  node scripts/build-marine-pattern.cjs
 */
const fs = require("fs");
const path = require("path");

// Pool both the 8 gate silhouettes and the wider marine set fetched by
// scripts/fetch-pattern-silhouettes.cjs, for variety.
const SILHOUETTE_DIRS = [
  path.join(__dirname, "..", "public", "silhouettes"),
  path.join(__dirname, "..", "public", "patterns", "silhouettes"),
];
const OUT_DIR = path.join(__dirname, "..", "public", "patterns");
const OUT_FILE = path.join(OUT_DIR, "marine-pattern.svg");

// --- Layout knobs -----------------------------------------------------------
// WhatsApp-doodle density, but with organic variation: a jittered grid keeps
// the field even while wide position + size scatter stops it reading as a
// mechanical lattice. Icons stay near-upright (gentle tilt + mirror only).
const TILE = 600; // tile size in px
const GRID = 8; // cells per axis -> GRID*GRID instances per tile
const BASE = 48; // base icon box (px) before per-instance scale
const JITTER = 0.42; // wide positional scatter (fraction of a cell)
const SCALE_MIN = 0.6; // wide size range -> strong small/large variation
const SCALE_MAX = 1.45;
const ROT_MAX = 20; // max tilt in degrees; icons stay near-upright
const SEED = 20260602;

// Kept OUT of the pattern. Two reasons:
//  - blobs: read as heavy/ambiguous ink masses, not clean icons
//    (judged via scripts/silhouette-contact-sheet.cjs);
//  - non-UK: FishSpotter is a UK marine-monitoring product, so species not
//    found in UK waters are excluded.
// All still exist on disk for the gate / future use.
const EXCLUDE = new Set([
  "gastropod", // blob: coiled solid mass
  "squid", // blob: curled mass, does not read as squid
  "octopus", // blob: dark messy mass
  "mussel", // blob: featureless oval
  "barnacle", // blob: unrecognisable spiky cluster
  "anemone", // blob: heavy mushroom
  "turtle", // non-UK: reads as a tropical sea turtle
]);

// Deterministic PRNG (mulberry32) so the asset is reproducible.
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const between = (lo, hi) => lo + (hi - lo) * rand();

// --- Read silhouettes -> <symbol> defs --------------------------------------
const entries = [];
for (const dir of SILHOUETTE_DIRS) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".svg")).sort()) {
    entries.push({ name: path.basename(f, ".svg"), file: path.join(dir, f) });
  }
}

const symbols = [];
const shapeIds = [];
for (const { name, file } of entries) {
  if (EXCLUDE.has(name)) continue;
  const raw = fs.readFileSync(file, "utf8");
  const vb = (raw.match(/viewBox="([^"]+)"/) || [])[1];
  if (!vb) {
    console.warn(`! ${file}: no viewBox, skipping`);
    continue;
  }
  // Inner content = everything between the root <svg ...> and </svg>,
  // minus the <metadata> block.
  let inner = raw
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .replace(/<metadata>[\s\S]*?<\/metadata>/gi, "")
    .trim();
  const id = `m-${name}`;
  shapeIds.push(id);
  symbols.push(
    `<symbol id="${id}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" fill="currentColor">${inner}</symbol>`,
  );
}

if (shapeIds.length === 0) {
  console.error("No silhouettes found. Aborting.");
  process.exit(1);
}

// --- Scatter instances on a jittered grid -----------------------------------
const cell = TILE / GRID;
const uses = [];
const round = (n) => Math.round(n * 10) / 10;

for (let gy = 0; gy < GRID; gy++) {
  for (let gx = 0; gx < GRID; gx++) {
    const cx = (gx + 0.5) * cell + between(-JITTER, JITTER) * cell;
    const cy = (gy + 0.5) * cell + between(-JITTER, JITTER) * cell;
    const scale = between(SCALE_MIN, SCALE_MAX);
    const box = BASE * scale;
    // Gentle tilt only (near-upright), plus an optional horizontal mirror so
    // travel direction varies without ever flipping an animal upside-down.
    const angle = Math.round(between(-ROT_MAX, ROT_MAX));
    const mirror = rand() < 0.5;
    const id = shapeIds[Math.floor(rand() * shapeIds.length)];

    // Toroidal wrap: emit the instance plus any neighbour copies that reach
    // into the [0, TILE] window, so the tile is seamless when repeated.
    const reach = box; // generous bound covering rotation corners
    for (const dx of [-TILE, 0, TILE]) {
      for (const dy of [-TILE, 0, TILE]) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < -reach || x > TILE + reach || y < -reach || y > TILE + reach) {
          continue;
        }
        const rx = round(x);
        const ry = round(y);
        // Mirror about the icon's own centre (x), then tilt about it.
        const tf = mirror
          ? `rotate(${angle} ${rx} ${ry}) translate(${round(2 * x)} 0) scale(-1 1)`
          : `rotate(${angle} ${rx} ${ry})`;
        uses.push(
          `<use href="#${id}" x="${round(x - box / 2)}" y="${round(
            y - box / 2,
          )}" width="${round(box)}" height="${round(box)}" transform="${tf}"/>`,
        );
      }
    }
  }
}

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}" ` +
  `viewBox="0 0 ${TILE} ${TILE}" fill="currentColor">` +
  `<defs>${symbols.join("")}</defs>` +
  uses.join("") +
  `</svg>`;

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, svg, "utf8");
console.log(
  `Wrote ${path.relative(path.join(__dirname, ".."), OUT_FILE)} ` +
    `(${shapeIds.length} shapes, ${GRID * GRID} instances, ${uses.length} <use>, ${(
      svg.length / 1024
    ).toFixed(1)} kB)`,
);

// Rasterise to a PNG tile. The high-detail potrace paths are very expensive to
// re-rasterise as a tiled CSS mask (the browser repaints every path per tile);
// a single pre-rendered PNG decodes once and GPU-tiles cheaply, which is why
// real doodle backgrounds ship as PNGs. Rendered at 2x then downsampled for
// crisp, antialiased edges. The SVG is kept as the editable source.
const PNG_FILE = path.join(OUT_DIR, "marine-pattern.png");
(async () => {
  try {
    const sharp = require("sharp");
    await sharp(Buffer.from(svg), { density: 144 })
      .resize(TILE, TILE)
      .png({ compressionLevel: 9 })
      .toFile(PNG_FILE);
    const kb = (fs.statSync(PNG_FILE).size / 1024).toFixed(1);
    console.log(
      `Wrote ${path.relative(path.join(__dirname, ".."), PNG_FILE)} (${TILE}x${TILE}, ${kb} kB)`,
    );
  } catch (err) {
    console.warn(
      `! Skipped PNG raster (${err.message}). The component can still use the SVG, ` +
        `but install sharp for the cheaper PNG tile.`,
    );
  }
})();
