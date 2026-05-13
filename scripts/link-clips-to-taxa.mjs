// Links each clip (Snippet) to the most-likely Taxon based on:
//   1. CSV candidate observations within the clip's time window
//   2. Consistency with the AI's functional_group tag
//
// Outcomes:
//   - Strong species match (candidate consistent with FG)  -> STAFF_LABELLED with species
//   - FG-only match (candidates exist but inconsistent)    -> STAFF_LABELLED with FG taxon
//   - No candidates at all                                  -> UNLABELLED (becomes Help-us-ID)

import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();
const MATCHES_FILE = path.join(__dirname, "..", "data", "clip-matches.json");

// FG → keyword tests (lowercased) to decide if a candidate common name is consistent.
const FG_COMPATIBILITY = {
  Crab: (c) => /crab/.test(c),
  Fish: (c) => /^(?!.*(crab|jelly|whelk|snail|squid|gobies|goby|dragonet|cumacea)).+/.test(c),
  Flatfish: (c) => /(flounder|plaice|dab|sole|turbot|flatfish|halibut|brill)/.test(c),
  Jellyfish: (c) => /(jelly|lion's mane|moon|sea gooseberry|ctenophora|cyanea|aurelia)/.test(c),
  Gastropod: (c) => /(whelk|snail|limpet|gastropod|nucella)/.test(c),
  Scooter: (c) => /(goby|dragonet)/.test(c),
};

function normalizeAlias(s) {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^(a|an|the)\s+/i, "")
    .trim();
}

async function resolveTaxon(displayName) {
  if (!displayName) return null;
  const norm = normalizeAlias(displayName);
  if (!norm) return null;
  const alias = await prisma.taxonAlias.findUnique({
    where: { alias: norm },
    include: { taxon: true },
  });
  return alias?.taxon ?? null;
}

async function getFunctionalGroupTaxon(name) {
  return prisma.taxon.findFirst({
    where: { name, isFunctionalGroup: true },
  });
}

async function main() {
  const matches = JSON.parse(fs.readFileSync(MATCHES_FILE, "utf-8"));
  console.log(`Loaded ${matches.length} clip match records.\n`);

  let speciesLabelled = 0;
  let fgLabelled = 0;
  let unlabelled = 0;

  for (const m of matches) {
    const snippet = await prisma.snippet.findUnique({
      where: { externalId: m.clip },
    });
    if (!snippet) {
      console.log(`  [skip] ${m.clip} not in DB`);
      continue;
    }

    const fg = m.functional_group;
    const candidates = m.candidates ?? [];

    let staffTaxonId = null;
    let resolution = "UNLABELLED";

    if (candidates.length > 0) {
      // Tally candidates by (common_name|sci) — take the most-cited that's consistent with FG.
      const tally = new Map();
      for (const c of candidates) {
        const key = `${(c.common || "").toLowerCase()}|${c.sci || ""}`;
        if (!tally.has(key)) tally.set(key, { common: c.common, sci: c.sci, count: 0 });
        tally.get(key).count++;
      }
      const sorted = Array.from(tally.values()).sort((a, b) => b.count - a.count);

      const fgTest = FG_COMPATIBILITY[fg];
      const consistentCandidate = fgTest
        ? sorted.find((c) => c.common && fgTest(c.common.toLowerCase()))
        : sorted[0];

      if (consistentCandidate) {
        // Try species first, then common name
        const taxon =
          (consistentCandidate.sci && (await resolveTaxon(consistentCandidate.sci))) ||
          (consistentCandidate.common && (await resolveTaxon(consistentCandidate.common)));
        if (taxon) {
          staffTaxonId = taxon.id;
          resolution = `STAFF_LABELLED → ${taxon.name}${taxon.scientificName ? ` (${taxon.scientificName})` : ""}`;
          speciesLabelled++;
        }
      }
    }

    // Fall back to functional-group taxon ONLY if we had candidates (some human eyes saw something nearby).
    // Clips with zero candidates stay UNLABELLED → they become Help-us-ID for users.
    if (!staffTaxonId && fg && candidates.length > 0) {
      const fgTaxon = await getFunctionalGroupTaxon(fg);
      if (fgTaxon) {
        staffTaxonId = fgTaxon.id;
        resolution = `STAFF_LABELLED → ${fgTaxon.name} (functional group)`;
        fgLabelled++;
      }
    }

    if (!staffTaxonId) unlabelled++;

    await prisma.snippet.update({
      where: { id: snippet.id },
      data: {
        staffTaxonId,
        labelStatus: staffTaxonId ? "STAFF_LABELLED" : "UNLABELLED",
      },
    });

    console.log(`  ${m.clip.slice(0, 55).padEnd(55)} fg=${(fg || "?").padEnd(10)} → ${resolution}`);
  }

  console.log(`\nResults:`);
  console.log(`  Species-labelled:           ${speciesLabelled}`);
  console.log(`  Functional-group labelled:  ${fgLabelled}`);
  console.log(`  Unlabelled (Help us ID):    ${unlabelled}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
