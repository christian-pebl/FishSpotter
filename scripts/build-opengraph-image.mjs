// Renders the static social-share card (src/app/opengraph-image.png) from an
// SVG source. Run this once whenever the design changes; the PNG is what
// actually ships (Next.js's file-based metadata convention picks up a static
// opengraph-image.<ext> automatically, no route code needed).
//
// Why static instead of next/og's dynamic ImageResponse: this card's content
// never varies per-request, and Next's bundled @vercel/og has a long-standing
// Windows-only build bug (join(import.meta.url, ...) instead of new URL(...),
// see https://github.com/vercel/next.js/issues/77164) that breaks local
// production builds. A pre-rendered static file sidesteps that code path
// entirely and is strictly more correct for genuinely static content.
//
//   node scripts/build-opengraph-image.mjs
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const WIDTH = 1200;
const HEIGHT = 630;
const NAVY = "#17252A";
const TEAL = "#3AAFA9";
const WHITE = "#FFFFFF";
const PALE_TEAL = "#DEF2F1";
const FONT = "Segoe UI, Helvetica, Arial, sans-serif";

// resvg (sharp's SVG rasteriser) renders text on the alphabetic baseline
// regardless of dominant-baseline, so these y values are baselines, computed
// by hand from each element's font-size (ascent ~= 0.75em) plus the original
// component's margins, then centred as a block in the 630-80*2=470px content
// box (matches what the original flexbox column + justifyContent:center did).
const svg = `
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${NAVY}" />
  <text x="96" y="137" font-family="${FONT}"
        font-size="30" font-weight="600" letter-spacing="6" fill="${TEAL}">PEBL CIC</text>
  <text x="96" y="273" font-family="${FONT}"
        font-size="132" font-weight="700" fill="${WHITE}">FishSpotter</text>
  <text x="96" y="372" font-family="${FONT}"
        font-size="44" font-weight="400" fill="${PALE_TEAL}">
    <tspan x="96" dy="0">Spot the species in UK marine</tspan>
    <tspan x="96" dy="55">monitoring clips</tspan>
  </text>
  <rect x="96" y="505" width="220" height="10" rx="5" fill="${TEAL}" />
</svg>
`.trim();

const outPath = join(process.cwd(), "src", "app", "opengraph-image.png");
await sharp(Buffer.from(svg)).png().toFile(outPath);
console.log(`wrote ${outPath}`);
