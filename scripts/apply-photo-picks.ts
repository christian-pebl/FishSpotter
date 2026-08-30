/**
 * Apply reviewed contact-sheet picks to the gallery.
 *
 * Reads .tmp/picks.json (tile numbers) against the per-species manifests the
 * sheet builder wrote, upserts the kept photos as non-curated gallery rows in
 * pick order, and adds the named rejects to photo-blocklist.json.
 *
 * Deliberately does NOT delete anything. build-species-galleries.ts deletes
 * what it did not re-choose, which is right when it has re-assessed the whole
 * pool; here a human has looked at a sample and said "these are good", which
 * is not the same claim as "everything else is bad".
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const BLOCKLIST_PATH = path.join(process.cwd(), "src", "data", "photo-blocklist.json");
const SHEETS_DIR = process.env.SHEETS_DIR ?? "implementation/photo-review/sheets";
const PICKS_PATH = process.env.PICKS_PATH ?? "implementation/photo-review/picks.json";

type Cand = {
  n: number; url: string; thumbUrl: string | null; sourceUrl: string;
  attribution: string; license: string; source: "inaturalist" | "wikimedia";
  width: number | null; height: number | null; lifeStage: string | null; sex: string | null;
  observedOn: string | null; placeGuess: string | null; existing: boolean;
};
type Manifest = { scientificName: string; commonName: string; candidates: Cand[] };
type Pick = { keep: number[]; reject: Record<string, string>; note?: string };

function slug(sci: string) {
  return sci.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

async function main() {
  const picks = JSON.parse(await fs.readFile(PICKS_PATH, "utf8")) as Record<string, Pick>;
  const bl = JSON.parse(await fs.readFile(BLOCKLIST_PATH, "utf8")) as {
    _README: string; blocked: Record<string, { reason: string; scientificName: string }>;
  };

  let added = 0, blocked = 0, missing = 0;
  const summary: string[] = [];

  for (const [sci, pick] of Object.entries(picks)) {
    if (sci.startsWith("_")) continue;
    const manifestPath = path.join(SHEETS_DIR, `${slug(sci)}.json`);
    let manifest: Manifest;
    try {
      manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as Manifest;
    } catch {
      console.log(`  !! no manifest for ${sci}`);
      continue;
    }
    const byN = new Map(manifest.candidates.map((c) => [c.n, c]));

    // Ordering starts above any curated row so the hero stays first.
    let ordering = 20;
    let speciesAdded = 0;
    for (const n of pick.keep) {
      const c = byN.get(n);
      if (!c) { console.log(`  !! ${sci} tile ${n} not in manifest`); missing++; continue; }
      if (APPLY) {
        await prisma.speciesImage.upsert({
          where: { scientificName_sourceUrl: { scientificName: sci, sourceUrl: c.sourceUrl } },
          create: {
            scientificName: sci, url: c.url, thumbUrl: c.thumbUrl, attribution: c.attribution,
            sourceUrl: c.sourceUrl, license: c.license, lifeStage: c.lifeStage, sex: c.sex,
            width: c.width, height: c.height, observedOn: c.observedOn, placeGuess: c.placeGuess,
            ordering: ordering++, source: c.source, curated: false,
          },
          update: {
            url: c.url, thumbUrl: c.thumbUrl, attribution: c.attribution, license: c.license,
            width: c.width, height: c.height, observedOn: c.observedOn, placeGuess: c.placeGuess,
            ordering: ordering++, source: c.source, refreshedAt: new Date(),
          },
        });
      } else {
        ordering++;
      }
      speciesAdded++; added++;
    }

    let speciesBlocked = 0;
    for (const [nStr, reason] of Object.entries(pick.reject)) {
      const c = byN.get(Number(nStr));
      if (!c) { missing++; continue; }
      if (!bl.blocked[c.sourceUrl]) {
        bl.blocked[c.sourceUrl] = { reason, scientificName: sci };
        speciesBlocked++; blocked++;
      }
    }
    summary.push(`  ${manifest.commonName.padEnd(28)} +${String(speciesAdded).padStart(2)} kept, ${String(speciesBlocked).padStart(2)} blocked`);
  }

  console.log(summary.join("\n"));
  console.log(`\nkept: ${added}; newly blocklisted: ${blocked}; tiles not found: ${missing}`);

  if (APPLY) {
    const sorted: typeof bl = { _README: bl._README, blocked: {} };
    for (const k of Object.keys(bl.blocked).sort()) sorted.blocked[k] = bl.blocked[k];
    await fs.writeFile(BLOCKLIST_PATH, JSON.stringify(sorted, null, 2) + "\n", "utf8");
    console.log("blocklist written");
  } else {
    console.log("(dry run; pass --apply)");
  }
  await prisma.$disconnect();
}
main();
