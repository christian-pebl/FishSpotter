import { PrismaClient } from '@prisma/client';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();
const outDir = join(process.cwd(), 'backups');
mkdirSync(outDir, { recursive: true });

async function dump(name: string, rows: unknown) {
  const file = join(outDir, `${name}.json`);
  writeFileSync(file, JSON.stringify(rows, null, 2));
  const count = Array.isArray(rows) ? rows.length : 'n/a';
  console.log(`  ${name}: ${count} rows -> ${file}`);
}

async function main() {
  console.log('Backing up tables and columns about to be dropped...\n');

  const taxon = await prisma.$queryRawUnsafe('SELECT * FROM "Taxon"');
  await dump('taxon', taxon);

  const taxonAlias = await prisma.$queryRawUnsafe('SELECT * FROM "TaxonAlias"');
  await dump('taxon-alias', taxonAlias);

  const taxonAttribute = await prisma.$queryRawUnsafe('SELECT * FROM "TaxonAttribute"');
  await dump('taxon-attribute', taxonAttribute);

  const biogeo = await prisma.$queryRawUnsafe('SELECT * FROM "BiogeographicChecklist"');
  await dump('biogeographic-checklist', biogeo);

  const answerPoints = await prisma.$queryRawUnsafe(
    'SELECT id, "pointsAwarded" FROM "Answer" WHERE "pointsAwarded" IS NOT NULL'
  );
  await dump('answer-points-awarded', answerPoints);

  const snippetCols = await prisma.$queryRawUnsafe(
    'SELECT id, "labelStatus", "staffTaxonId" FROM "Snippet"'
  );
  await dump('snippet-label-and-taxon', snippetCols);

  console.log('\nDone. All backups written to ./backups/');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
