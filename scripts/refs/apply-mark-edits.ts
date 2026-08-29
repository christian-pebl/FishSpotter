/**
 * Apply the diagnostic-mark corrections that `apply-proposals.ts` reported.
 *
 * Marks are production database rows, and their `description` is the teaching
 * text a learner reads off the annotated photo. `apply-proposals.ts` writes
 * every other correction straight into the repo but deliberately stops here
 * and only REPORTS these, because a script that parses a proposal file should
 * not quietly rewrite live rows in the same breath. This is the second, named
 * step that does it, and it prints the before and after for every row.
 *
 * Dry run is the default. Nothing is written without `--apply`.
 *
 *   npx tsx --env-file=.env.local scripts/refs/apply-mark-edits.ts
 *   npx tsx --env-file=.env.local scripts/refs/apply-mark-edits.ts --apply
 *     --species "X"   one species only
 */

import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const REPORT = path.join(process.cwd(), ".refs-cache", "apply-report.json");

type MarkEdit = { species: string; key: string; label?: string; text?: string; note?: string };

async function main() {
  const argv = process.argv.slice(2);
  const write = argv.includes("--apply");
  const only = argv.includes("--species") ? argv[argv.indexOf("--species") + 1] : undefined;

  if (!fs.existsSync(REPORT)) {
    console.error("No .refs-cache/apply-report.json. Run apply-proposals.ts first.");
    process.exit(1);
  }
  const report = JSON.parse(fs.readFileSync(REPORT, "utf8")) as { markEdits: MarkEdit[] };
  const edits = (report.markEdits ?? []).filter((e) => !only || e.species === only);
  if (edits.length === 0) {
    console.log("No mark corrections to apply.");
    return;
  }

  const prisma = new PrismaClient();
  let changed = 0;
  let skipped = 0;

  for (const e of edits) {
    const id = e.key.replace(/^mark:/, "");
    const row = await prisma.diagnosticMark.findUnique({
      select: { id: true, scientificName: true, label: true, description: true },
      where: { id },
    });
    if (!row) {
      console.log(`  ? ${e.species} ${id}: no such mark row, skipped`);
      skipped++;
      continue;
    }
    // A proposal names a mark by id, but the id came from a brief built for one
    // species. If those disagree, something is crossed and it must not write.
    if (row.scientificName !== e.species) {
      console.log(`  ! ${id}: proposal says ${e.species}, row says ${row.scientificName}, skipped`);
      skipped++;
      continue;
    }
    const label = e.label ?? row.label;
    const description = e.text ?? row.description;
    if (label === row.label && description === row.description) {
      skipped++;
      continue;
    }
    console.log(`\n  ${row.scientificName}  ${id}`);
    if (label !== row.label) {
      console.log(`    label  - ${row.label}`);
      console.log(`           + ${label}`);
    }
    if (description !== row.description) {
      console.log(`    text   - ${row.description}`);
      console.log(`           + ${description}`);
    }
    if (e.note) console.log(`    why    ${e.note}`);
    if (write) {
      await prisma.diagnosticMark.update({ where: { id }, data: { label, description } });
    }
    changed++;
  }

  await prisma.$disconnect();
  console.log(
    `\n${write ? "Applied" : "DRY RUN, nothing written"}: ${changed} mark(s) would change, ${skipped} unchanged or skipped.`,
  );
  if (!write && changed > 0) console.log("Re-run with --apply to write them.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
