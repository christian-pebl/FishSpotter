/**
 * Shared library used by both `scripts/refresh-images.ts` and the
 * `/api/cron/refresh-images` route. Same code, same upsert path, same
 * manifest handling. The cron uses a time budget so a single invocation
 * stays inside Vercel's 60-second function limit; the local script has no
 * budget and grinds through every species.
 */
import { PrismaClient } from "@prisma/client";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import speciesImagesManifest from "@/data/species-images.json";
import photoBlocklist from "@/data/photo-blocklist.json";
import { fetchPhotosForSpecies, type InatPhoto } from "@/lib/biodiversity/inaturalist";
import { fetchPhotosFromWikimedia, type WikimediaPhoto } from "@/lib/biodiversity/wikimedia";

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

// sourceUrls Gemini flagged as drawing / dead / wrong-subject. Never cache
// them, so the weekly refresh can't re-add junk the purge removed. Editorial
// overrides intentionally bypass this (a human pin wins).
const BLOCKED_SOURCES = new Set(
  Object.keys((photoBlocklist as { blocked: Record<string, unknown> }).blocked),
);
const THROTTLE_MS = 1100;
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
// Q3A-T5: when a species has fewer than MIN_PHOTOS rows in DB after the
// iNat bucket loop, top up via Wikimedia Commons. Threshold is low
// enough that well-covered species (most of the catalogue) skip the second
// network call entirely.
const MIN_PHOTOS_BEFORE_WIKIMEDIA_TOPUP = 3;

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
    observedOn: p.observedOn,
    placeGuess: p.placeGuess,
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
    observedOn: p.observedOn,
    placeGuess: p.placeGuess,
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
  // older than STALE_AFTER_MS. Cheap query for the catalogue species we have.
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
  // Guard: never let a bucket photo overwrite a curated override that points at
  // the SAME observation. iNat photo URLs share the observation as their
  // sourceUrl, and the upsert is keyed on (scientificName, sourceUrl), so a
  // bucket fetch that surfaces the override's own observation would otherwise
  // replace the hand-picked frame with that observation's representative photo.
  const overrideSourceUrls = new Set(overrides.map((o) => o.sourceUrl));
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
      // Don't clobber a curated override of the same observation.
      if (overrideSourceUrls.has(p.sourceUrl)) continue;
      // Skip Gemini-flagged junk (drawing / dead / wrong-subject).
      if (BLOCKED_SOURCES.has(p.sourceUrl)) continue;
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

  // 3. Q3A-T5: Wikimedia Commons top-up. Only fires when iNat returned
  //    a thin set so well-covered species don't burn a second network
  //    call. Wikimedia rows are tagged `source = "wikimedia"` and
  //    `curated = false` (the curated flag is reserved for editorial
  //    overrides in src/data/species-images.json).
  const currentCount = await prisma.speciesImage.count({ where: { scientificName } });
  if (currentCount < MIN_PHOTOS_BEFORE_WIKIMEDIA_TOPUP) {
    const need = MIN_PHOTOS_BEFORE_WIKIMEDIA_TOPUP - currentCount;
    log(`  thin coverage (${currentCount} rows); topping up via Wikimedia (need ${need})…`);
    try {
      const wm = await fetchPhotosFromWikimedia({
        scientificName,
        limit: need + 2, // overshoot a little; the upsert dedupe by sourceUrl absorbs collisions
      });
      let added = 0;
      for (const p of wm) {
        if (BLOCKED_SOURCES.has(p.sourceUrl)) continue; // Gemini-flagged junk
        try {
          await prisma.speciesImage.upsert({
            where: { scientificName_sourceUrl: { scientificName, sourceUrl: p.sourceUrl } },
            create: wikimediaToCreate(scientificName, p, ordering),
            update: wikimediaToUpdate(p, ordering),
          });
          rowsUpserted++;
          ordering++;
          added++;
        } catch (err) {
          log(`  Wikimedia upsert failed: ${err instanceof Error ? err.message : err}`);
        }
      }
      log(`  Wikimedia → ${added} photo(s)`);
    } catch (err) {
      log(`  Wikimedia top-up failed (non-fatal): ${err instanceof Error ? err.message : err}`);
    }
  }

  log(`  → ${rowsUpserted} upserted, ${emptyBuckets} empty bucket(s)`);
  return { rowsUpserted, emptyBuckets };
}

function wikimediaToCreate(scientificName: string, p: WikimediaPhoto, ordering: number) {
  return {
    scientificName,
    url: p.url,
    thumbUrl: p.thumbUrl,
    attribution: p.attribution,
    sourceUrl: p.sourceUrl,
    license: p.license,
    lifeStage: null,
    sex: null,
    width: p.width,
    height: p.height,
    ordering,
    source: "wikimedia",
    curated: false,
  };
}

function wikimediaToUpdate(p: WikimediaPhoto, ordering: number) {
  return {
    url: p.url,
    thumbUrl: p.thumbUrl,
    attribution: p.attribution,
    license: p.license,
    width: p.width,
    height: p.height,
    ordering,
    source: "wikimedia",
    refreshedAt: new Date(),
  };
}
