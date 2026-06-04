/**
 * Debug utility: render a species' CURRENT diagnostic-mark rings onto its
 * curated hero photo and save a PNG, so a human can eyeball ring placement
 * (ground-truth for the Gemini-graded placement loop). Read-only.
 *
 *   npx tsx --env-file=.env.local scripts/render-hero.ts -- --species "X" [--out path.png]
 * Or render explicit coords from the placement log's latest after-state:
 *   ...-- --species "X" --from-log
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync, readFileSync } from "fs";
import sharp from "sharp";
import { buildOverlaySvg, loadImage, type MarkRow } from "./lib/mark-overlay";

const prisma = new PrismaClient();

async function main() {
  const argv = process.argv.slice(2);
  let species: string | undefined;
  let out: string | undefined;
  let fromLog = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--species") species = argv[++i];
    else if (argv[i] === "--out") out = argv[++i];
    else if (argv[i] === "--from-log") fromLog = true;
  }
  if (!species) throw new Error("--species required");

  const hero = await prisma.speciesImage.findFirst({
    where: { scientificName: species, curated: true },
    orderBy: [{ ordering: "asc" }, { createdAt: "asc" }],
    select: { url: true },
  });
  if (!hero) throw new Error("no curated photo");

  let marks: MarkRow[];
  if (fromLog) {
    const txt = readFileSync("implementation/2026-06-04/placement-log.json", "utf8").trim();
    const objs = txt
      .split(/\n(?=\{)/)
      .map((s) => {
        try {
          return JSON.parse(s);
        } catch {
          return null;
        }
      })
      .filter(Boolean) as Array<{ results: Array<{ scientificName: string; after: MarkRow[] }> }>;
    let found: MarkRow[] | null = null;
    for (let i = objs.length - 1; i >= 0 && !found; i--) {
      const r = objs[i].results.find((x) => x.scientificName === species);
      if (r && r.after.length) found = r.after;
    }
    if (!found) throw new Error("species not in placement log");
    marks = found;
  } else {
    const rows = await prisma.diagnosticMark.findMany({
      where: { scientificName: species },
      orderBy: { order: "asc" },
    });
    marks = rows.map((m) => ({
      label: m.label,
      description: m.description,
      overlayX: m.overlayX,
      overlayY: m.overlayY,
      overlayRadius: m.overlayRadius,
    }));
  }

  const { buf, width, height } = await loadImage(hero.url);
  const svg = buildOverlaySvg(width, height, marks);
  const png = await sharp(buf)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
  const path = out ?? `.pc-tmp/hero-${species.replace(/\s+/g, "_")}.png`;
  writeFileSync(path, png);
  console.log(`wrote ${path} (${width}x${height}, ${marks.length} marks)`);
  marks.forEach((m, i) =>
    console.log(`  ${i + 1} ${m.label}  x=${m.overlayX.toFixed(2)} y=${m.overlayY.toFixed(2)} r=${m.overlayRadius.toFixed(2)}`),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
