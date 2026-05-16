/**
 * Shared library used by both `scripts/refresh-images.ts` and the
 * `/api/cron/refresh-images` route. Same code, same upsert path, same
 * manifest handling. The cron uses a time budget so a single invocation
 * stays inside Vercel's 60-second function limit; the local script has no
 * budget and grinds through every species.
 */
import { PrismaClient } from "@prisma/client";
import speciesTraitsData from "@/data/species-traits.json";
import speciesImagesManifest from "@/data/species-images.json";
import { fetchPhotosForSpecies, type InatPhoto } from "@/lib/biodiversity/inaturalist";

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
const THROTTLE_MS = 1100;
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function bucketsFor(scientificName: string): Bucket[] {
  const entry = MANIFEST.species[scientificName];
  if (entry?.buckets && entry.buckets.length > 0) return entry.buckets;
  return MANIFEST._defaultBuckets;
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
    refreshedAt: new Date(),
  };
}

export type RefreshResult = {
  scanned: number;
  processedSpecies: number;
  rowsUpserted: number;
  emptyBuckets: number;
  skippedFresh: number;
  errors: Array<{ scientificName: string; message: string }>;
  remaining: number; // species still needing work after this run
};

export async function refreshSpeciesImages(opts: {
  prisma: PrismaClient;
  /** Limit the run to a single species (script's --species flag). */
  scientificName?: string;
  /** Skip species whose rows are all younger than STALE_AFTER_MS. */
  staleOnly?: boolean;
  /** Hard cap on species processed (cron: 12). */
  maxSpecies?: number;
  /** Soft time budget; the loop exits before starting a new species when exceeded. */
  budgetMs?: number;
  /** Logging hook (script uses console.log; cron stays silent). */
  onProgress?: (msg: string) => void;
}): Promise<RefreshResult> {
  const { prisma, onProgress } = opts;
  const log = (m: string) => onProgress?.(m);

  const allSpecies = opts.scientificName
    ? [opts.scientificName]
    : Object.keys(CATALOGUE).filter((k) => !k.startsWith("_"));

  // Stale filter: a species needs work if it has zero rows OR if any row is
  // older than STALE_AFTER_MS. Cheap query for the ~26 species we have.
  const targets: string[] = [];
  if (opts.staleOnly) {
    const cutoff = new Date(Date.now() - STALE_AFTER_MS);
    for (const sci of allSpecies) {
      const oldest = await prisma.speciesImage.findFirst({
        where: { scientificName: sci },
        orderBy: { refreshedAt: "asc" },
        select: { refreshedAt: true },
      });
      if (!oldest || oldest.refreshedAt < cutoff) targets.push(sci);
    }
  } else {
    targets.push(...allSpecies);
  }

  const result: RefreshResult = {
    scanned: targets.length,
    processedSpecies: 0,
    rowsUpserted: 0,
    emptyBuckets: 0,
    skippedFresh: allSpecies.length - targets.length,
    errors: [],
    remaining: 0,
  };

  const startedAt = Date.now();
  const cap = opts.maxSpecies ?? Infinity;
  const budgetMs = opts.budgetMs ?? Infinity;

  for (let i = 0; i < targets.length; i++) {
    if (result.processedSpecies >= cap) {
      result.remaining = targets.length - i;
      break;
    }
    if (Date.now() - startedAt > budgetMs) {
      result.remaining = targets.length - i;
      break;
    }

    const sci = targets[i];
    const commonName = CATALOGUE[sci]?.commonName ?? "(unknown)";
    log(`\n[${sci}] (${commonName})`);

    try {
      const upserts = await refreshOneSpecies(prisma, sci, log);
      result.rowsUpserted += upserts.rowsUpserted;
      result.emptyBuckets += upserts.emptyBuckets;
      result.processedSpecies++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(`  FAILED ${sci}: ${message}`);
      result.errors.push({ scientificName: sci, message });
    }
  }

  return result;
}

async function refreshOneSpecies(
  prisma: PrismaClient,
  scientificName: string,
  log: (m: string) => void,
) {
  let rowsUpserted = 0;
  let emptyBuckets = 0;

  // 1. Apply explicit overrides first — they're upserted curated=true and the
  //    iNat path below never overwrites them.
  const overrides = (MANIFEST.overrides[scientificName] ?? []).filter(
    (row): row is OverrideRow => typeof row === "object" && !!row.url && !!row.sourceUrl,
  );
  for (const row of overrides) {
    await prisma.speciesImage.upsert({
      where: { scientificName_sourceUrl: { scientificName, sourceUrl: row.sourceUrl } },
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
    rowsUpserted++;
    log(`  curated: ${row.lifeStage ?? "?"}${row.sex ? " " + row.sex : ""} → kept`);
  }

  // 2. Fetch per bucket.
  const buckets = bucketsFor(scientificName);
  let ordering = 10;

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
          where: { scientificName_sourceUrl: { scientificName, sourceUrl: p.sourceUrl } },
          create: imageCreate(scientificName, p, ordering, bucket),
          update: imageUpdate(p, ordering, bucket),
        });
        rowsUpserted++;
        ordering++;
      } catch (err) {
        log(`  upsert failed: ${err instanceof Error ? err.message : err}`);
      }
    }
    if (selected.length === 0) {
      emptyBuckets++;
      log(`  bucket {ls:${bucket.lifeStage ?? "*"}, sex:${bucket.sex ?? "*"}} → no photos`);
    } else {
      log(
        `  bucket {ls:${bucket.lifeStage ?? "*"}, sex:${bucket.sex ?? "*"}} → ${selected.length}`,
      );
    }
    await sleep(THROTTLE_MS);
  }

  log(`  → ${rowsUpserted} upserted, ${emptyBuckets} empty bucket(s)`);
  return { rowsUpserted, emptyBuckets };
}
