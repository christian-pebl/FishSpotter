/**
 * Backfill observedOn (date/year) + placeGuess (location) onto SpeciesImage
 * rows that were cached before those columns existed — chiefly the `curated`
 * reference photos, which the gallery builder never re-fetches.
 *
 * Only iNaturalist observation rows can be enriched (Wikimedia file pages and
 * editorial pins carry no structured observation metadata). The source link
 * looks like https://www.inaturalist.org/observations/<id>; we extract the id,
 * batch-query iNat (fetchObservationMeta, 30/call), and patch the rows.
 *
 * Read-only against everything except the two new metadata columns. Idempotent:
 * by default only touches rows where observedOn IS NULL; pass --force to refresh
 * all iNat rows.
 *
 *   npx tsx --env-file=.env.local scripts/enrich-image-meta.ts
 *   ... --force
 */
import { PrismaClient } from "@prisma/client";
import { fetchObservationMeta } from "../src/lib/biodiversity/inaturalist";

const prisma = new PrismaClient();

const OBS_ID = /inaturalist\.org\/observations\/(\d+)/i;

async function main() {
  const force = process.argv.includes("--force");
  const rows = await prisma.speciesImage.findMany({
    where: force ? {} : { observedOn: null },
    select: { id: true, sourceUrl: true },
  });

  const idToRows = new Map<number, string[]>();
  for (const r of rows) {
    const m = r.sourceUrl.match(OBS_ID);
    if (!m) continue;
    const obsId = Number(m[1]);
    const arr = idToRows.get(obsId) ?? [];
    arr.push(r.id);
    idToRows.set(obsId, arr);
  }

  const ids = [...idToRows.keys()];
  console.log(`${rows.length} candidate rows, ${ids.length} distinct iNat observations to query.`);
  if (ids.length === 0) {
    console.log("Nothing to enrich.");
    return;
  }

  const meta = await fetchObservationMeta(ids);
  let updated = 0;
  let withDate = 0;
  let withPlace = 0;
  for (const [obsId, rowIds] of idToRows) {
    const m = meta.get(obsId);
    if (!m) continue;
    if (m.observedOn) withDate++;
    if (m.placeGuess) withPlace++;
    if (!m.observedOn && !m.placeGuess) continue;
    await prisma.speciesImage.updateMany({
      where: { id: { in: rowIds } },
      data: { observedOn: m.observedOn, placeGuess: m.placeGuess },
    });
    updated += rowIds.length;
  }
  console.log(
    `Enriched ${updated} rows (${withDate} observations had a date, ${withPlace} had a place).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
