/**
 * Purge flag-identified junk photos from the SpeciesImage gallery so each
 * species shows only good-quality reference photos.
 *
 * Input: an assess-all.json produced by `npm run images:assess -- --all --json`
 * (the Gemini photo-quality sweep). This script trusts the ROBUST categorical
 * flags only (nonPhotographic / wrong-subject / dead-or-beachcast), NOT the
 * noisy fine-grained scores, so it won't delete a merely "poor" living photo.
 *
 * Safety guards (a flagged photo is SKIPPED, never deleted, if any apply):
 *   - it has DiagnosticMark rows (deleting would orphan the teaching guide),
 *   - it is the species' only photo (don't leave a species with zero),
 *   - it is `curated` (a human pinned it — surface for manual review instead),
 *     unless --include-curated is passed.
 *
 * DRY-RUN BY DEFAULT. Pass --apply to actually delete. This is a prod DB write,
 * so review the dry-run first.
 *
 *   npm run db:purge-bad-photos                 # dry-run from ./assess-all.json
 *   npm run db:purge-bad-photos -- --file x.json
 *   npm run db:purge-bad-photos -- --apply      # execute the SAFE deletes
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Assessed = {
  scientificName: string;
  url: string;
  curated: boolean;
  quality: {
    nonPhotographic?: boolean;
    subjectType?: string;
    condition?: string;
  } | null;
};

function parseArgs() {
  const argv = process.argv.slice(2);
  let file = "assess-all.json";
  let apply = false;
  let includeCurated = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--file" && argv[i + 1]) file = argv[++i];
    else if (argv[i] === "--apply") apply = true;
    else if (argv[i] === "--include-curated") includeCurated = true;
  }
  return { file, apply, includeCurated };
}

function junkReason(a: Assessed): string | null {
  const q = a.quality;
  if (!q) return null;
  const r: string[] = [];
  if (q.nonPhotographic) r.push("drawing");
  if (q.subjectType === "wrong-subject") r.push("wrong-subject");
  if (q.condition === "dead-or-beachcast") r.push("dead");
  return r.length ? r.join("+") : null;
}

async function main() {
  const args = parseArgs();
  const raw = fs.readFileSync(args.file, "utf8");
  const data = JSON.parse(raw.slice(raw.indexOf("["))) as Assessed[];

  // Flagged junk only.
  const junk = data.map((a) => ({ a, reason: junkReason(a) })).filter((x) => x.reason);

  // Photo count per species (to protect the last photo).
  const counts = new Map<string, number>();
  for (const a of data) counts.set(a.scientificName, (counts.get(a.scientificName) ?? 0) + 1);

  const toDelete: Array<{ id: string; sci: string; url: string; reason: string }> = [];
  const skipped: Array<{ sci: string; url: string; reason: string; why: string }> = [];

  for (const { a, reason } of junk) {
    const row = await prisma.speciesImage.findFirst({
      where: { scientificName: a.scientificName, url: a.url },
      include: { _count: { select: { diagnosticMarks: true } } },
    });
    if (!row) {
      skipped.push({ sci: a.scientificName, url: a.url, reason: reason!, why: "not in DB" });
      continue;
    }
    if (row._count.diagnosticMarks > 0) {
      skipped.push({ sci: a.scientificName, url: a.url, reason: reason!, why: "has diagnostic marks" });
      continue;
    }
    if ((counts.get(a.scientificName) ?? 0) <= 1) {
      skipped.push({ sci: a.scientificName, url: a.url, reason: reason!, why: "only photo for species" });
      continue;
    }
    if (row.curated && !args.includeCurated) {
      skipped.push({ sci: a.scientificName, url: a.url, reason: reason!, why: "curated (manual review)" });
      continue;
    }
    toDelete.push({ id: row.id, sci: a.scientificName, url: a.url, reason: reason! });
  }

  console.log(`Flagged junk: ${junk.length} | SAFE to delete: ${toDelete.length} | skipped: ${skipped.length}\n`);
  console.log("=== WOULD DELETE ===");
  for (const d of toDelete) console.log(`  [${d.reason}] ${d.sci}  ${d.url}`);
  console.log("\n=== SKIPPED (need manual review) ===");
  for (const s of skipped) console.log(`  [${s.reason}] ${s.why} — ${s.sci}  ${s.url}`);

  if (!args.apply) {
    console.log(`\nDRY-RUN. Re-run with --apply to delete the ${toDelete.length} SAFE rows.`);
    return;
  }

  let deleted = 0;
  for (const d of toDelete) {
    await prisma.speciesImage.delete({ where: { id: d.id } });
    deleted++;
  }
  console.log(`\nDeleted ${deleted} junk photos.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
