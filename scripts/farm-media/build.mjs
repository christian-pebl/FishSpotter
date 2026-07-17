// Optimises the raw farm photos (downloaded from each farm's own website, with
// permission) into web-ready WebP under public/farm-media/<slug>/.
//
// Not a CI script: it reads the raw source images from a scratch dir (the
// scrape output) and writes the committed, optimised assets. The originals are
// NOT committed (same model as species photos); only the webp derivatives are.
// Each entry records the source URL for provenance.
//
//   node scripts/farm-media/build.mjs [sourceDir] [outDir]
//
// Defaults: sourceDir = the scrape scratch dir; outDir = ./public/farm-media.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

const SOURCE_DIR =
  process.argv[2] ??
  "C:/Users/CHRIST~1/AppData/Local/Temp/claude/C--Users-Christian-Abulhawa-FishSpotter/a2038cf8-106a-4f5e-b291-58c5ac808953/scratchpad/farm-media";
const OUT_DIR = process.argv[3] ?? join(process.cwd(), "public", "farm-media");

const HERO_WIDTH = 1600;
const GALLERY_WIDTH = 1200;

// slug -> ordered picks. First is the hero; the rest become g1..gN.
// `file` is the scrape filename; `src` is the origin URL (provenance only).
const PICKS = {
  algapelago: [
    { file: "img_01.webp", role: "hero", src: "algapelago.com DJI_0197 (workboat DORIS + crew + farm buoys)" },
    { file: "img_02.webp", role: "gallery", src: "algapelago.com DJI_0250 (aerial cliffs + workboat wake)" },
    { file: "img_14.webp", role: "gallery", src: "algapelago.com hatchery seaweed cultures" },
    { file: "img_12.webp", role: "gallery", src: "algapelago.com harvested seaweed close-up" },
    { file: "img_05.webp", role: "gallery", src: "algapelago.com crew water-sampling with probe" },
    { file: "img_08.webp", role: "gallery", src: "algapelago.com crew on beach, workboat behind" },
  ],
  "atlantic-mariculture": [
    { file: "img_01.jpg", role: "hero", src: "atlanticmariculture.co.uk aerial-view-boats-in-seaweed-farm" },
    { file: "img_03.jpg", role: "gallery", src: "atlanticmariculture.co.uk seaweed-farms-ardnamurchan (buoy grid + mountains)" },
    { file: "img_08.jpg", role: "gallery", src: "atlanticmariculture.co.uk harvested-kelp-taken-to-factory" },
    { file: "img_06.jpg", role: "gallery", src: "atlanticmariculture.co.uk seaweed-farming (worker holding kelp)" },
    { file: "img_14.jpg", role: "gallery", src: "atlanticmariculture.co.uk ardtoe-marine-laboratory (hatchery tanks)" },
    { file: "img_10.jpg", role: "gallery", src: "atlanticmariculture.co.uk liquid-kelp-fertiliser (IBC totes)" },
  ],
  "kelp-crofters": [
    { file: "img_04.jpg", role: "hero", src: "kelpcrofters.com Pabay_Harvest_2022 (crew hauling kelp)" },
    { file: "img_12.jpg", role: "gallery", src: "kelpcrofters.com IMG_7206 (full crew hauling kelp)" },
    { file: "img_08.jpg", role: "gallery", src: "kelpcrofters.com Sugar kelp curtain on grow-line" },
    { file: "img_06.jpg", role: "gallery", src: "kelpcrofters.com Alaria_Pabay_Spring2022 (kelp hauled from loch)" },
    { file: "img_03.jpg", role: "gallery", src: "kelpcrofters.com work boat AILSA moored, worker on deck" },
    { file: "img_01.jpg", role: "gallery", src: "kelpcrofters.com AILSA under the Red Cuillins" },
  ],
  "car-y-mor": [
    { file: "img_06.jpg", role: "hero", src: "carymor.wales 013 (worker hauling seaweed line, coast behind)" },
    { file: "img_01.jpg", role: "gallery", src: "carymor.wales harvest team, kelp frond aloft, cliff" },
    { file: "img_11.jpg", role: "gallery", src: "carymor.wales community sorting shellfish on the barge" },
    { file: "img_04.jpg", role: "gallery", src: "carymor.wales 001 (wide farm site, float-line across sound)" },
    { file: "img_10.jpg", role: "gallery", src: "carymor.wales gaff-rigged boat + float-line along cliffs" },
    { file: "img_02.jpg", role: "gallery", src: "carymor.wales ferg_barge (farmer hauling kelp, portrait)" },
  ],
  "norfolk-seaweed": [
    { file: "img_01.jpg", role: "hero", src: "norfolkseaweed.com Willie Athill at the helm, branded jacket" },
    { file: "img_12.jpg", role: "gallery", src: "norfolkseaweed.com grading pacific oysters by the creek" },
    { file: "img_08.jpg", role: "gallery", src: "norfolkseaweed.com holding red seaweed at the water's edge" },
    { file: "img_14.jpg", role: "gallery", src: "norfolkseaweed.com sunset over the Stiffkey Freshes creeks" },
    { file: "img_05.jpg", role: "gallery", src: "norfolkseaweed.com collecting seaweed samples at low tide" },
    { file: "img_06.jpg", role: "gallery", src: "norfolkseaweed.com workboat Morning Flight in the hoist (portrait)" },
  ],
  kaly: [
    { file: "img_01.jpg", role: "hero", src: "kaly.eco Loch Bay panorama, Stein village" },
    { file: "img_05.jpg", role: "gallery", src: "kaly.eco working boats at the Loch Bay pier (golden light)" },
    { file: "img_07.jpg", role: "gallery", src: "kaly.eco freshly harvested kelp close-up" },
    { file: "img_04.jpg", role: "gallery", src: "kaly.eco Skye scenery, crofting cottages, Cuillins" },
    { file: "img_02.jpg", role: "gallery", src: "kaly.eco aerial of the Waternish base (church + manse)" },
    { file: "img_03.jpg", role: "gallery", src: "kaly.eco dramatic weather over the loch (portrait)" },
  ],
};

let total = 0;
for (const [slug, picks] of Object.entries(PICKS)) {
  const outSlugDir = join(OUT_DIR, slug);
  await mkdir(outSlugDir, { recursive: true });
  let g = 0;
  for (const pick of picks) {
    const input = join(SOURCE_DIR, slug, pick.file);
    const outName = pick.role === "hero" ? "hero.webp" : `g${++g}.webp`;
    const output = join(outSlugDir, outName);
    await mkdir(dirname(output), { recursive: true });
    const width = pick.role === "hero" ? HERO_WIDTH : GALLERY_WIDTH;
    const info = await sharp(input)
      .rotate() // honour EXIF orientation
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(output);
    total++;
    console.log(`${slug}/${outName}  ${info.width}x${info.height}  ${Math.round(info.size / 1024)}KB  <- ${pick.file}`);
  }
}
console.log(`\nDone: ${total} images written to ${OUT_DIR}`);
