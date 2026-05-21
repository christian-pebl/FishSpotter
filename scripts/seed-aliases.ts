/**
 * Seed the SpeciesAlias table from src/data/species-aliases.json plus
 * auto-resolved scientific names from SpeciesNameMap.
 *
 * Idempotent — upserts each row by `canonical`. Safe to run repeatedly
 * (e.g. after editing the JSON to add a new alias).
 *
 * Run: npm run db:seed-aliases
 */

import { PrismaClient } from "@prisma/client";
import aliasesData from "../src/data/species-aliases.json";
import { normalizeAnswer } from "../src/lib/normalize-answer";

const prisma = new PrismaClient();

type Editorial = {
  [scientific: string]: { commonName: string; aliases: string[] };
};

async function main() {
  const editorial = aliasesData as Editorial;
  const entries = Object.entries(editorial);
  console.log(`Seeding ${entries.length} alias rows…`);

  // Side-lookup: scientific name → cached common name from GBIF resolutions
  // (the SpeciesNameMap is keyed by normalized common name → scientific).
  // We use this only as a sanity-check / log signal; the editorial JSON is
  // the source of truth for aliases.
  const nameMaps = await prisma.speciesNameMap.findMany({
    where: { scientificName: { in: Object.keys(editorial) } },
    select: { commonName: true, scientificName: true },
  });
  const sciToResolvedCommon = new Map<string, string>();
  for (const row of nameMaps) {
    if (row.scientificName) sciToResolvedCommon.set(row.scientificName, row.commonName);
  }

  let upserted = 0;
  for (const [scientificName, { commonName, aliases }] of entries) {
    // The acceptable-forms set always includes:
    //   - the scientific binomial (canonical)
    //   - the common name from species-traits / editorial
    //   - any editorial aliases
    //   - whatever name resolved via GBIF (insurance against drift)
    const sciAlias = sciToResolvedCommon.get(scientificName);
    const fullAliases = Array.from(
      new Set([
        commonName,
        ...aliases,
        ...(sciAlias ? [sciAlias] : []),
      ]),
    ).filter((a) => normalizeAnswer(a) !== normalizeAnswer(scientificName));

    await prisma.speciesAlias.upsert({
      where: { canonical: scientificName },
      create: {
        canonical: scientificName,
        normalizedKey: normalizeAnswer(scientificName),
        aliases: fullAliases,
      },
      update: {
        normalizedKey: normalizeAnswer(scientificName),
        aliases: fullAliases,
      },
    });
    upserted++;
    if (process.env.VERBOSE) {
      console.log(`  ${scientificName}: ${fullAliases.length} aliases`);
    }
  }

  console.log(`Done. Upserted ${upserted} rows.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
