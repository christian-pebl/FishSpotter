/**
 * Q3A-T4 migration: flip any SpeciesImage that has authored DiagnosticMark
 * rows attached to `curated = true`.
 *
 * Why: the photo-quality gate (this same ticket) makes diagnostic marks
 * only render on curated photos. Today (2026-05-27 evening) the pollack
 * pilot's 3 marks are attached to a stock iNat photo with `curated =
 * false`; if the gate shipped without flipping that photo, the rings
 * would silently disappear from the wizard. This script runs in the
 * same commit as the gate to keep the migration atomic.
 *
 * Idempotent: only touches rows that are currently `curated = false`
 * AND have at least one DiagnosticMark. Re-runs are no-ops.
 *
 * Run: npm run db:migrate-curated-flag
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find SpeciesImage rows that host marks but aren't curated yet.
  const candidates = await prisma.speciesImage.findMany({
    where: {
      curated: false,
      diagnosticMarks: { some: {} },
    },
    select: {
      id: true,
      scientificName: true,
      sourceUrl: true,
      _count: { select: { diagnosticMarks: true } },
    },
  });

  if (candidates.length === 0) {
    console.log("No photos to migrate. All mark-hosting photos are already curated.");
    return;
  }

  console.log(`Flipping ${candidates.length} mark-hosting photo(s) to curated = true:`);
  for (const c of candidates) {
    console.log(`  ${c.scientificName}: ${c._count.diagnosticMarks} mark(s), ${c.sourceUrl}`);
  }

  const result = await prisma.speciesImage.updateMany({
    where: { id: { in: candidates.map((c) => c.id) } },
    data: { curated: true },
  });

  console.log(`\nDone. ${result.count} photo(s) flipped to curated.`);
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
