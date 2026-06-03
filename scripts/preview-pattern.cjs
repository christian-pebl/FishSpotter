/* Dev-only: renders an accurate mock of how the marine pattern looks in
 * context (brand gradient + pattern tinted teal at the real opacity + a mock
 * auth card), so we can judge it without the flaky browser screenshot.
 * Output: public/patterns/_preview.png (delete after viewing). */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const W = 900;
const H = 600;
const TILE = 600;
const OPACITY = 0.1; // matches text-teal-600/[0.10] in auth/layout.tsx

(async () => {
  const patternPng = fs.readFileSync(
    path.join(ROOT, "public", "patterns", "marine-pattern.png"),
  );

  // Brand background gradient (mirrors the body gradient in globals.css).
  const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7fffe"/><stop offset="0.5" stop-color="#def2f1"/><stop offset="1" stop-color="#ccebea"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/></svg>`;

  // Recolour the (black-on-transparent) pattern to teal at the real opacity:
  // start from a teal-at-OPACITY tile, keep it only where the pattern is opaque.
  const tealTile = await sharp({
    create: {
      width: TILE,
      height: TILE,
      channels: 4,
      background: { r: 43, g: 122, b: 120, alpha: OPACITY },
    },
  })
    .composite([{ input: patternPng, blend: "dest-in" }])
    .png()
    .toBuffer();

  // Mock auth card to show the "behind the card" context.
  const cw = 420;
  const ch = 380;
  const cx = (W - cw) / 2;
  const cy = (H - ch) / 2;
  const card = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="24" fill="#ffffff" fill-opacity="0.92" stroke="#17252a" stroke-opacity="0.1"/>
    <text x="${cx + 28}" y="${cy + 46}" font-family="sans-serif" font-size="11" letter-spacing="2" fill="#1f5f5d">PEBL COMMUNITY ACCESS</text>
    <text x="${cx + 28}" y="${cy + 84}" font-family="sans-serif" font-size="26" font-weight="700" fill="#17252a">Sign in to continue</text>
    <rect x="${cx + 28}" y="${cy + 118}" width="${cw - 56}" height="44" rx="14" fill="#eef9f8" stroke="#17252a" stroke-opacity="0.12"/>
    <rect x="${cx + 28}" y="${cy + 178}" width="${cw - 56}" height="44" rx="14" fill="#eef9f8" stroke="#17252a" stroke-opacity="0.12"/>
    <rect x="${cx + 28}" y="${cy + 246}" width="${cw - 56}" height="46" rx="23" fill="#3AAFA9"/>
    <text x="${W / 2}" y="${cy + 275}" font-family="sans-serif" font-size="15" font-weight="700" text-anchor="middle" fill="#17252a">Sign in</text>
  </svg>`;

  const out = path.join(ROOT, "public", "patterns", "_preview.png");
  await sharp(Buffer.from(bg))
    .composite([
      { input: tealTile, tile: true, blend: "over" },
      { input: Buffer.from(card), blend: "over" },
    ])
    .png()
    .toFile(out);
  console.log("wrote", out);
})();
