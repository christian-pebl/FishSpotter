// One-shot cleanup of taxonomic errors and duplicate placeholders.
// Idempotent — safe to re-run; no-ops if already cleaned.
//
// Validation sources:
//   - WoRMS (marinespecies.org) for accepted names
//   - FishBase for vernaculars
//   - NBN Atlas (UK biodiversity) for British distribution

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizeAlias(s) {
  if (!s) return "";
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(a|an|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Rename a taxon's scientific name and (optionally) display name.
 * Also updates the existing TaxonAlias rows that mirror those fields.
 */
async function renameTaxon({ from, to, newDisplayName, newCommonAlias }) {
  const t = await prisma.taxon.findUnique({ where: { scientificName: from } });
  if (!t) {
    console.log(`  ${from}: not found, skipping`);
    return;
  }
  // Avoid clashes with an existing taxon under the new name
  const collision = await prisma.taxon.findUnique({ where: { scientificName: to } });
  if (collision && collision.id !== t.id) {
    console.log(`  ${from} → ${to}: target name already used by ${collision.id}, skipping`);
    return;
  }

  // Rename taxon
  await prisma.taxon.update({
    where: { id: t.id },
    data: {
      scientificName: to,
      ...(newDisplayName ? { name: newDisplayName } : {}),
    },
  });

  // Sync the scientific-name alias
  const oldSciAlias = normalizeAlias(from);
  const newSciAlias = normalizeAlias(to);
  if (oldSciAlias !== newSciAlias) {
    // Delete a colliding new-alias row first (could exist if both forms were seeded)
    await prisma.taxonAlias.deleteMany({ where: { alias: newSciAlias, taxonId: { not: t.id } } });
    // Update the old alias row in place if present
    const old = await prisma.taxonAlias.findUnique({ where: { alias: oldSciAlias } });
    if (old && old.taxonId === t.id) {
      await prisma.taxonAlias.update({
        where: { id: old.id },
        data: { alias: newSciAlias, display: to },
      });
    } else {
      // Create the new sci alias if missing
      await prisma.taxonAlias.upsert({
        where: { alias: newSciAlias },
        create: { taxonId: t.id, alias: newSciAlias, display: to, source: "scientific" },
        update: { taxonId: t.id, display: to, source: "scientific" },
      });
    }
  }

  // Optionally add a new common-name alias (e.g. preferred display name)
  if (newCommonAlias) {
    const norm = normalizeAlias(newCommonAlias);
    await prisma.taxonAlias.upsert({
      where: { alias: norm },
      create: { taxonId: t.id, alias: norm, display: newCommonAlias, source: "common" },
      update: { taxonId: t.id, display: newCommonAlias, source: "common" },
    });
  }

  console.log(`  ${from} → ${to}${newDisplayName ? ` (display: ${newDisplayName})` : ""}: ✓`);
}

/**
 * Delete a taxon by either scientificName or by (name, scientificName=null).
 * Cascades remove TaxonAttribute and TaxonAlias rows.
 * Aborts if the taxon is referenced as a staffTaxon or in any Answer.
 */
async function deleteTaxon({ scientificName = null, name = null, isFunctionalGroup = false, reason }) {
  const where = {
    isFunctionalGroup,
    ...(scientificName ? { scientificName } : { scientificName: null }),
    ...(name ? { name } : {}),
  };
  const t = await prisma.taxon.findFirst({ where });
  if (!t) {
    console.log(`  delete ${scientificName ?? name}: not found`);
    return;
  }
  const usage = await prisma.taxon.findUnique({
    where: { id: t.id },
    select: { _count: { select: { snippets: true, answers: true } } },
  });
  if (usage._count.snippets > 0 || usage._count.answers > 0) {
    console.log(`  delete ${scientificName ?? name}: ABORT — still referenced (snippets=${usage._count.snippets}, answers=${usage._count.answers})`);
    return;
  }
  await prisma.taxon.delete({ where: { id: t.id } });
  console.log(`  deleted ${scientificName ?? name} (${reason})`);
}

async function main() {
  console.log("\n=== Renames ===");
  await renameTaxon({
    from: "Cyanea capitata",
    to:   "Cyanea capillata",
    newCommonAlias: "lion's mane jellyfish",
  });
  await renameTaxon({
    from: "Trisopterus iuscus",
    to:   "Trisopterus luscus",
    newCommonAlias: "bib",
  });
  await renameTaxon({
    from: "Psetta maxima",
    to:   "Scophthalmus maximus", // WoRMS-accepted name
  });

  console.log("\n=== Display-name fixes ===");
  // "Nursehound/catshark" with sci Scyliorhinus canicula → really the small-spotted catshark
  const cs = await prisma.taxon.findUnique({ where: { scientificName: "Scyliorhinus canicula" } });
  if (cs) {
    await prisma.taxon.update({
      where: { id: cs.id },
      data: { name: "Small-spotted Catshark" },
    });
    // Add common-name alias
    const a = "small-spotted catshark";
    await prisma.taxonAlias.upsert({
      where: { alias: a },
      create: { taxonId: cs.id, alias: a, display: "Small-spotted Catshark", source: "common" },
      update: { taxonId: cs.id, display: "Small-spotted Catshark", source: "common" },
    });
    console.log("  Scyliorhinus canicula → Small-spotted Catshark: ✓");
  }

  // "Poor Cod/pouting" sci=Trisopterus → genus-level, rename display for clarity
  const tg = await prisma.taxon.findUnique({ where: { scientificName: "Trisopterus" } });
  if (tg) {
    await prisma.taxon.update({ where: { id: tg.id }, data: { name: "Trisopterus (genus)" } });
    console.log("  Trisopterus (genus): ✓");
  }

  console.log("\n=== Deletions ===");
  await deleteTaxon({
    scientificName: "Paralichthys dentatus",
    reason: "wrong species (US summer flounder, not N. Atlantic temperate); flounders covered by Platichthys flesus",
  });
  await deleteTaxon({ name: "Cod",       reason: "no-sci dup of Gadus morhua" });
  await deleteTaxon({ name: "Dragonet",  reason: "no-sci dup of Callionymidae + species rows" });
  await deleteTaxon({ name: "Sand Goby", reason: "no-sci dup of Pomatoschistus minutus" });
  await deleteTaxon({ name: "Sideways Crab", reason: "placeholder, no scientific identity" });
  await deleteTaxon({ name: "Whelk",     reason: "no-sci dup; whelks covered by Nucella lapillus" });

  // Merge Trisopterus sp and Trisopterus sp. (same thing, just punctuation difference)
  const sp = await prisma.taxon.findUnique({ where: { scientificName: "Trisopterus sp" } });
  const sp2 = await prisma.taxon.findUnique({ where: { scientificName: "Trisopterus sp." } });
  if (sp && sp2 && sp.id !== sp2.id) {
    // Keep "Trisopterus sp." (WoRMS convention with period), delete the other
    const usage = await prisma.taxon.findUnique({
      where: { id: sp.id },
      select: { _count: { select: { snippets: true, answers: true } } },
    });
    if (usage._count.snippets === 0 && usage._count.answers === 0) {
      await prisma.taxon.delete({ where: { id: sp.id } });
      console.log("  deleted 'Trisopterus sp' (kept 'Trisopterus sp.')");
    }
  }

  console.log("\n=== Final counts ===");
  const total = await prisma.taxon.count();
  const fg = await prisma.taxon.count({ where: { isFunctionalGroup: true } });
  console.log(`  ${total} taxa total (${fg} functional groups, ${total - fg} species/genus/family)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
