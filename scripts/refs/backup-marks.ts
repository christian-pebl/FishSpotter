/**
 * Dump every DiagnosticMark row before a bulk rewrite.
 *
 * apply-mark-edits.ts changes the teaching text a learner reads off the
 * annotated photo, across most of the catalogue at once. The apply report
 * records a before and after per row, but that file lives in .refs-cache and is
 * gitignored, so it is not a restore point. This is.
 *
 *   npx tsx --env-file=.env.local scripts/refs/backup-marks.ts [--out <path>]
 */

import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const argv = process.argv.slice(2);
  const out =
    argv.includes("--out")
      ? argv[argv.indexOf("--out") + 1]
      : path.join(process.cwd(), "backups", "diagnostic-marks.json");

  const prisma = new PrismaClient();
  const rows = await prisma.diagnosticMark.findMany({
    select: {
      id: true,
      scientificName: true,
      label: true,
      description: true,
      order: true,
      overlayX: true,
      overlayY: true,
      overlayRadius: true,
      speciesImageId: true,
      createdBy: true,
    },
    orderBy: [{ scientificName: "asc" }, { order: "asc" }],
  });
  await prisma.$disconnect();

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ takenOn: new Date().toISOString().slice(0, 10), rows }, null, 2));
  console.log(`Backed up ${rows.length} DiagnosticMark rows to ${path.relative(process.cwd(), out)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
