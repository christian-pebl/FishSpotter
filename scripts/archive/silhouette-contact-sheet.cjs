/* Dev-only: renders every pooled silhouette into a labeled grid so we can
 * critically curate which read as clean marine icons vs heavy/unreadable
 * blobs. Output: public/patterns/_contact-sheet.png (gitignore-able). */
const fs = require("fs");
const path = require("path");

const DIRS = [
  path.join(__dirname, "..", "public", "silhouettes"),
  path.join(__dirname, "..", "public", "patterns", "silhouettes"),
];

const entries = [];
for (const dir of DIRS) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".svg")).sort()) {
    const raw = fs.readFileSync(path.join(dir, f), "utf8");
    const vb = (raw.match(/viewBox="([^"]+)"/) || [])[1];
    if (!vb) continue;
    const inner = raw
      .replace(/^[\s\S]*?<svg[^>]*>/, "")
      .replace(/<\/svg>\s*$/, "")
      .replace(/<metadata>[\s\S]*?<\/metadata>/gi, "")
      .trim();
    entries.push({ name: path.basename(f, ".svg"), vb, inner });
  }
}

const COLS = 6;
const CELL = 170;
const PAD = 16;
const LABEL = 22;
const rows = Math.ceil(entries.length / COLS);
const W = COLS * CELL;
const H = rows * CELL;

let defs = "";
let cells = "";
entries.forEach((e, i) => {
  const id = `s${i}`;
  defs += `<symbol id="${id}" viewBox="${e.vb}" preserveAspectRatio="xMidYMid meet">${e.inner}</symbol>`;
  const cx = (i % COLS) * CELL;
  const cy = Math.floor(i / COLS) * CELL;
  const box = CELL - PAD * 2 - LABEL;
  cells +=
    `<rect x="${cx + 1}" y="${cy + 1}" width="${CELL - 2}" height="${CELL - 2}" fill="none" stroke="#ccc"/>` +
    `<use href="#${id}" x="${cx + PAD}" y="${cy + PAD}" width="${box}" height="${box}" fill="#17252a"/>` +
    `<text x="${cx + CELL / 2}" y="${cy + CELL - 8}" font-family="sans-serif" font-size="13" text-anchor="middle" fill="#17252a">${e.name}</text>`;
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/><defs>${defs}</defs>${cells}</svg>`;

const out = path.join(__dirname, "..", "public", "patterns", "_contact-sheet.png");
(async () => {
  const sharp = require("sharp");
  await sharp(Buffer.from(svg), { density: 144 }).png().toFile(out);
  console.log(`Wrote ${out} (${entries.length} shapes)`);
})();
