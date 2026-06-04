/**
 * Orientation audit (read-only): ask Gemini whether each species' curated hero
 * photo is correctly oriented (animal's natural posture: a fish's dorsal/back up
 * and belly down, etc.). Catches upside-down / rotated source photos that the
 * placement+grade loop misses (it grades the rings, not whether the whole frame
 * is the right way up).
 *
 *   npx tsx --env-file=.env.local scripts/check-photo-orientation.ts
 *   ...-- --species "Labrus bergylta"
 * Read-only; prints a report + writes implementation/2026-06-04/orientation-audit.json.
 *
 * CAVEAT (observed 4 Jun 2026): Gemini orientation detection is NOISY. It has
 * BOTH false positives (it flags jellyfish as "rotated" though they drift in any
 * orientation, and a flatfish held vertically as "rotated") AND false negatives
 * (it scored a genuinely upside-down Ballan wrasse photo as "upright" at 95%).
 * Treat every flag as a CANDIDATE FOR HUMAN REVIEW, not a verdict: render the
 * photo (scripts/render-hero.ts or sharp) and judge by eye before acting.
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
import sharp from "sharp";
import speciesTraitsData from "../src/data/species-traits.json";
import { geminiJson, loadImage, GEMINI_MODEL } from "./lib/mark-overlay";

const prisma = new PrismaClient();
type Catalogue = Record<string, { commonName?: string }>;
const CATALOGUE = speciesTraitsData as unknown as Catalogue;

const SCHEMA = {
  type: "object",
  properties: {
    orientation: {
      type: "string",
      enum: ["upright", "upside-down", "rotated-90cw", "rotated-90ccw", "unclear"],
    },
    confidence: { type: "integer" },
    note: { type: "string" },
  },
  required: ["orientation", "confidence", "note"],
} as const;

function prompt(common: string, sci: string): string {
  return [
    `Look at this photo of ${common} (${sci}). Judging by the animal's NATURAL`,
    `posture in the water, is the PHOTO the right way up?`,
    `- A fish should have its dorsal fin / back along the top and its belly along`,
    `  the bottom, with the eye in the upper half of the head.`,
    `- A crab/starfish/shell: the body should look naturally placed, not inverted.`,
    `Report orientation: "upright" (correct), "upside-down" (rotated 180, e.g. fish`,
    `belly-up / dorsal at the bottom), "rotated-90cw" or "rotated-90ccw" (on its`,
    `side), or "unclear". Give confidence 0..100 and a one-line note. A fish resting`,
    `under an overhang can look inverted; judge by the body, not the background.`,
    `Do not use em dashes.`,
  ].join("\n");
}

async function main() {
  const argv = process.argv.slice(2);
  let only: string | undefined;
  for (let i = 0; i < argv.length; i++) if (argv[i] === "--species" && argv[i + 1]) only = argv[++i];

  const heroes = await prisma.diagnosticMark.groupBy({ by: ["scientificName"] });
  let names = heroes.map((h) => h.scientificName).sort();
  if (only) names = names.filter((n) => n === only);

  console.error(`[orientation] ${names.length} hero photos | ${GEMINI_MODEL}\n`);
  const results: Array<{ scientificName: string; commonName: string; url: string; orientation: string; confidence: number; note: string }> = [];

  for (const sci of names) {
    const hero = await prisma.speciesImage.findFirst({
      where: { scientificName: sci, curated: true },
      orderBy: [{ ordering: "asc" }, { createdAt: "asc" }],
      select: { url: true },
    });
    if (!hero) continue;
    const common = CATALOGUE[sci]?.commonName ?? sci;
    let line: { orientation: string; confidence: number; note: string };
    try {
      const { buf } = await loadImage(hero.url);
      const png = await sharp(buf).rotate().png().toBuffer(); // bake EXIF so we judge what the browser shows
      const r = await geminiJson(prompt(common, sci), png.toString("base64"), "image/png", SCHEMA);
      line = r.ok ? (r.data as typeof line) : { orientation: "unclear", confidence: 0, note: `error: ${r.error}` };
    } catch (e) {
      line = { orientation: "unclear", confidence: 0, note: `error: ${(e as Error).message}` };
    }
    results.push({ scientificName: sci, commonName: common, url: hero.url, ...line });
    const flag = line.orientation !== "upright" && line.orientation !== "unclear" ? "  <<< FLAG" : "";
    console.error(`  ${common.padEnd(28)} ${line.orientation.padEnd(13)} conf=${line.confidence}${flag}`);
  }

  writeFileSync("implementation/2026-06-04/orientation-audit.json", JSON.stringify(results, null, 2));
  const bad = results.filter((r) => r.orientation !== "upright" && r.orientation !== "unclear");
  console.error(`\n${bad.length} photo(s) flagged not-upright:`);
  for (const b of bad) console.error(`  ${b.commonName}: ${b.orientation} (conf ${b.confidence}) - ${b.note}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
