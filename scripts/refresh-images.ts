/**
 * Refreshes the SpeciesImage table from iNaturalist for every species in
 * the catalogue. Reads per-species filter buckets from
 * src/data/species-images.json so priority species (cuckoo wrasse, dragonet,
 * plaice, etc.) get male/female/juvenile/egg images, and the rest get a
 * generic adult set.
 *
 * Run: npx tsx --env-file=.env.local scripts/refresh-images.ts
 *      npx tsx --env-file=.env.local scripts/refresh-images.ts -- --species "Labrus mixtus"
 */
import { PrismaClient } from "@prisma/client";
import speciesTraitsData from "../src/data/species-traits.json";
import speciesImagesManifest from "../src/data/species-images.json";
import { fetchPhotosForSpecies, type InatPhoto } from "../src/lib/biodiversity/inaturalist";

const prisma = new PrismaClient();
const THROTTLE_MS = 1100; // <60 req/min, well inside iNat's recommended rate.

type Bucket = {
  lifeStage?: "adult" | "juvenile" | "larva" | "egg" | "subadult" | null;
  sex?: "male" | "female" | null;
  count?: number;
};

type Manifest = {
  _defaultBuckets: Bucket[];
  species: Record<string, { buckets?: Bucket[] }>;
  overrides: Record<string, OverrideRow[]>;
};

type OverrideRow = {
  url: string;
  thumbUrl?: string;
  attribution: string;
  sourceUrl: string;
  license: string;
  lifeStage?: string | null;
  sex?: string | null;
  width?: number | null;
  height?: number | null;
  ordering?: number;
};

const MANIFEST = speciesImagesManifest as unknown as Manifest;
const CATALOGUE = speciesTraitsData as unknown as Record<string, { commonName: string }>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseArgs() {
  const argv = process.argv.slice(2);
  let species: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--species" && argv[i + 1]) species = argv[i + 1];
  }
  return { species };
}

function bucketsFor(scientificName: string): Bucket[] {
  const entry = MANIFEST.species[scientificName];
  if (entry?.buckets && entry.buckets.length > 0) return entry.buckets;
  return MANIFEST._defaultBuckets;
}

async function refreshSpecies(scientificName: string, commonName: string) {
  console.log(`\n[${scientificName}] (${commonName})`);

  // 1. Apply explicit overrides first. These are upserted with curated=true
  //    and never overwritten by the iNat fetch below.
  const overrides = (MANIFEST.overrides[scientificName] ?? []).filter(
    (row): row is OverrideRow => typeof row === "object" && !!row.url && !!row.sourceUrl,
  );
  for (const row of overrides) {
    await prisma.speciesImage.upsert({
      where: {
        scientificName_sourceUrl: { scientificName, sourceUrl: row.sourceUrl },
      },
      create: {
        scientificName,
        url: row.url,
        thumbUrl: row.thumbUrl ?? null,
        attribution: row.attribution,
        sourceUrl: row.sourceUrl,
        license: row.license,
        lifeStage: row.lifeStage ?? null,
        sex: row.sex ?? null,
        width: row.width ?? null,
        height: row.height ?? null,
        ordering: row.ordering ?? 1,
        source: "manual",
        curated: true,
      },
      update: {
        url: row.url,
        thumbUrl: row.thumbUrl ?? null,
        attribution: row.attribution,
        license: row.license,
        lifeStage: row.lifeStage ?? null,
        sex: row.sex ?? null,
        width: row.width ?? null,
        height: row.height ?? null,
        ordering: row.ordering ?? 1,
        source: "manual",
        curated: true,
        refreshedAt: new Date(),
      },
    });
    console.log(`  curated: ${row.lifeStage ?? "?"}${row.sex ? " " + row.sex : ""} → kept`);
  }

  // 2. Fetch per bucket. Each bucket contributes `count` photos.
  const buckets = bucketsFor(scientificName);
  let ordering = 10;
  let inserted = 0;
  let skipped = 0;

  for (const bucket of buckets) {
    const photos = await fetchPhotosForSpecies({
      scientificName,
      perPage: Math.max(4, (bucket.count ?? 4) * 2),
      lifeStage: (bucket.lifeStage ?? undefined) as
        | "adult"
        | "juvenile"
        | "larva"
        | "egg"
        | "subadult"
        | undefined,
      sex: (bucket.sex ?? undefined) as "male" | "female" | undefined,
    });

    const take = bucket.count ?? 4;
    const selected = photos.slice(0, take);
    for (const p of selected) {
      try {
        await prisma.speciesImage.upsert({
          where: {
            scientificName_sourceUrl: { scientificName, sourceUrl: p.sourceUrl },
          },
          create: imageCreate(scientificName, p, ordering, bucket),
          update: imageUpdate(p, ordering, bucket),
        });
        inserted++;
        ordering++;
      } catch (err) {
        console.warn(`  upsert failed: ${err instanceof Error ? err.message : err}`);
      }
    }
    if (selected.length === 0) {
      skipped++;
      console.log(
        `  bucket {ls:${bucket.lifeStage ?? "*"}, sex:${bucket.sex ?? "*"}} → no photos`,
      );
    } else {
      console.log(
        `  bucket {ls:${bucket.lifeStage ?? "*"}, sex:${bucket.sex ?? "*"}} → ${selected.length}`,
      );
    }
    await sleep(THROTTLE_MS);
  }

  console.log(`  → ${inserted} inserted/updated, ${skipped} empty bucket(s)`);
}

function imageCreate(scientificName: string, p: InatPhoto, ordering: number, bucket: Bucket) {
  return {
    scientificName,
    url: p.mediumUrl,
    thumbUrl: p.url,
    attribution: p.attribution,
    sourceUrl: p.sourceUrl,
    license: p.license,
    lifeStage: p.lifeStage ?? bucket.lifeStage ?? null,
    sex: p.sex ?? bucket.sex ?? null,
    width: p.width,
    height: p.height,
    ordering,
    source: "inaturalist",
    curated: false,
  };
}

function imageUpdate(p: InatPhoto, ordering: number, bucket: Bucket) {
  return {
    url: p.mediumUrl,
    thumbUrl: p.url,
    attribution: p.attribution,
    license: p.license,
    lifeStage: p.lifeStage ?? bucket.lifeStage ?? null,
    sex: p.sex ?? bucket.sex ?? null,
    width: p.width,
    height: p.height,
    ordering,
    source: "inaturalist",
    // curated stays false so a manual override still wins if added later.
    refreshedAt: new Date(),
  };
}

async function main() {
  const { species } = parseArgs();
  const targets = species
    ? [species]
    : Object.keys(CATALOGUE).filter((k) => !k.startsWith("_"));

  console.log(`Refreshing images for ${targets.length} species...`);

  try {
    for (const sci of targets) {
      const commonName = CATALOGUE[sci]?.commonName ?? "(unknown)";
      try {
        await refreshSpecies(sci, commonName);
      } catch (err) {
        console.error(
          `  FAILED ${sci}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    console.log(`\nDone.`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
