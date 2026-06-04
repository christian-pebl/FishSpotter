/**
 * Apply marine-biologist review fixes to the seeded gadoid marks.
 *
 * Findings from reviewing the three iNat reference photos that the
 * seed script picked (lowest-ordering SpeciesImage per species):
 *
 *   - Pollachius pollachius — fish faces RIGHT, not LEFT. The seed
 *     script's left-facing default coords are mirrored. Update the
 *     three marks with corrected right-facing coords (head at the
 *     RIGHT side of the frame, ~x=0.75).
 *
 *   - Trisopterus luscus — the cached photo is a mixed school of
 *     ~7-8 fish in habitat. Can't anchor a "single chin barbel" or
 *     "deep tall body" mark on any specific fish without ambiguity.
 *     Delete the seeded marks. The user should curate a clean
 *     single-specimen photo into src/data/species-images.json as a
 *     manual override, re-run db:refresh-images, then re-run the
 *     seed script.
 *
 *   - Gadus morhua — the cached photo is a dead, decomposed,
 *     beach-cast specimen on pebbles. No visible lateral line, body
 *     bleached pale, mottling gone. Species ID itself is uncertain
 *     without the colour cues. Delete the seeded marks. Same curation
 *     recommendation as bib.
 *
 * Idempotent: only touches rows where createdBy = seed-script tag.
 * Admin-edited marks (any other createdBy) are left alone.
 *
 * Run: npm run db:adjust-gadoid-marks
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SEED_AUTHOR = "seed-script@pebl-cic.co.uk";

type CoordUpdate = {
  label: string; // matched against the seeded label
  overlayX: number;
  overlayY: number;
  overlayRadius: number;
};

// Pollack: fish faces right in the iNat photo (obs 250697031, 890x668).
// Head at right (~x=0.72), tail at left (~x=0.15).
const POLLACK_UPDATES: CoordUpdate[] = [
  {
    label: "Kinked lateral line",
    // Pectoral fin sits at ~x=0.62, y=0.45. The kink is right over it.
    overlayX: 0.58,
    overlayY: 0.42,
    overlayRadius: 0.08,
  },
  {
    label: "Projecting lower jaw",
    // Snout / jaw is the leading edge of the head on the right side.
    // Slightly larger radius — the feature is subtle in this profile.
    overlayX: 0.78,
    overlayY: 0.48,
    overlayRadius: 0.07,
  },
  {
    label: "No chin barbel",
    // Ventral surface just behind the snout.
    overlayX: 0.72,
    overlayY: 0.55,
    overlayRadius: 0.05,
  },
];

async function main() {
  /* ----------------------------- Pollack ----------------------------- */
  console.log("Adjusting pollack marks (fish faces RIGHT in this photo)…");
  let pollackUpdated = 0;
  for (const u of POLLACK_UPDATES) {
    const res = await prisma.diagnosticMark.updateMany({
      where: {
        scientificName: "Pollachius pollachius",
        label: u.label,
        createdBy: SEED_AUTHOR,
      },
      data: {
        overlayX: u.overlayX,
        overlayY: u.overlayY,
        overlayRadius: u.overlayRadius,
      },
    });
    pollackUpdated += res.count;
    console.log(`  "${u.label}" — ${res.count} row(s) updated`);
  }

  /* ------------------------------- Bib ------------------------------- */
  console.log("\nDeleting bib seed marks (photo is a mixed school, unusable)…");
  const bibDeleted = await prisma.diagnosticMark.deleteMany({
    where: {
      scientificName: "Trisopterus luscus",
      createdBy: SEED_AUTHOR,
    },
  });
  console.log(`  Deleted ${bibDeleted.count} bib seed mark(s).`);

  /* ------------------------------- Cod ------------------------------- */
  console.log("\nDeleting cod seed marks (photo is a dead beach-cast specimen, unusable)…");
  const codDeleted = await prisma.diagnosticMark.deleteMany({
    where: {
      scientificName: "Gadus morhua",
      createdBy: SEED_AUTHOR,
    },
  });
  console.log(`  Deleted ${codDeleted.count} cod seed mark(s).`);

  console.log(
    `\nDone. ${pollackUpdated} pollack mark(s) updated, ${bibDeleted.count + codDeleted.count} unusable mark(s) removed.`,
  );
  console.log(
    "\nNext steps for bib and cod:",
  );
  console.log(
    "  1. Find a clean single-specimen photo for each (live fish, lateral view, head clearly visible).",
  );
  console.log(
    "  2. Add an entry under `overrides` in src/data/species-images.json with the new URL + attribution.",
  );
  console.log(
    "  3. Run `npm run db:refresh-images -- --species \"Trisopterus luscus\"` (and again for Gadus morhua).",
  );
  console.log(
    "  4. Re-run `npm run db:seed-gadoid-marks` — it'll re-insert the bib + cod drafts onto the new photos.",
  );
}

main()
  .catch((err) => {
    console.error("Adjustment failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
