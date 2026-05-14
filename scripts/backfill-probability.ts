/**
 * Backfills SpeciesProbability rows (one per unique bucket) and SpeciesNameMap rows
 * (one per distinct staffAnswer) for every existing snippet.
 *
 * Run: npx tsx --env-file=.env.local scripts/backfill-probability.ts
 */
import { PrismaClient } from "@prisma/client";
import { bucketFor } from "../src/lib/biodiversity/buckets";
import { fetchTopSpeciesForBucket } from "../src/lib/biodiversity/obis";
import { resolveCommonName, normaliseCommonName } from "../src/lib/biodiversity/gbif-match";

const prisma = new PrismaClient();
const CACHE_TTL_DAYS = 90;
const THROTTLE_MS = 1100; // ~1 req / sec to be polite to OBIS

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function retry<T>(fn: () => Promise<T>, attempts = 3, baseMs = 1000): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const wait = baseMs * Math.pow(2, i);
      console.warn(`  retry ${i + 1}/${attempts} in ${wait}ms: ${err instanceof Error ? err.message : err}`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

async function backfillBuckets() {
  const snippets = await prisma.snippet.findMany({
    select: { id: true, lat: true, lon: true, depthM: true, recordingDatetime: true },
  });

  type BucketKey = ReturnType<typeof bucketFor> & object;
  const uniqueBuckets = new Map<string, BucketKey>();
  for (const s of snippets) {
    const b = bucketFor(s);
    if (!b) continue;
    const key = `${b.latBucket}|${b.lonBucket}|${b.depthBucket}|${b.month}`;
    if (!uniqueBuckets.has(key)) uniqueBuckets.set(key, b);
  }

  console.log(`\n=== Probability backfill ===`);
  console.log(`${snippets.length} snippets → ${uniqueBuckets.size} unique buckets`);

  let i = 0;
  for (const bucket of uniqueBuckets.values()) {
    i++;
    console.log(
      `[${i}/${uniqueBuckets.size}] lat=${bucket.latBucket} lon=${bucket.lonBucket} depth=${bucket.depthBucket} month=${bucket.month}`
    );

    const existing = await prisma.speciesProbability.findUnique({
      where: {
        latBucket_lonBucket_depthBucket_month: {
          latBucket: bucket.latBucket,
          lonBucket: bucket.lonBucket,
          depthBucket: bucket.depthBucket,
          month: bucket.month,
        },
      },
    });
    if (existing && existing.status !== "ERROR") {
      console.log(`  cached (${existing.status})`);
      continue;
    }

    try {
      const result = await retry(() => fetchTopSpeciesForBucket(bucket));
      const now = new Date();
      const staleAfter = new Date(now.getTime() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);

      const data =
        result.status === "OK"
          ? {
              status: "OK" as const,
              errorMessage: null,
              totalRecords: result.totalRecords,
              speciesJson: JSON.stringify(result.species),
            }
          : result.status === "INSUFFICIENT_DATA"
            ? {
                status: "INSUFFICIENT_DATA" as const,
                errorMessage: null,
                totalRecords: 0,
                speciesJson: "[]",
              }
            : {
                status: "ERROR" as const,
                errorMessage: result.errorMessage,
                totalRecords: 0,
                speciesJson: "[]",
              };

      await prisma.speciesProbability.upsert({
        where: {
          latBucket_lonBucket_depthBucket_month: {
            latBucket: bucket.latBucket,
            lonBucket: bucket.lonBucket,
            depthBucket: bucket.depthBucket,
            month: bucket.month,
          },
        },
        update: { ...data, fetchedAt: now, staleAfter },
        create: {
          latBucket: bucket.latBucket,
          lonBucket: bucket.lonBucket,
          depthBucket: bucket.depthBucket,
          month: bucket.month,
          source: "obis",
          fetchedAt: now,
          staleAfter,
          ...data,
        },
      });

      console.log(
        `  → ${result.status}` +
          (result.status === "OK"
            ? ` (${result.totalRecords} records, top: ${result.species[0]?.scientificName})`
            : "")
      );
    } catch (err) {
      console.error(`  FAILED: ${err instanceof Error ? err.message : err}`);
    }

    await sleep(THROTTLE_MS);
  }
}

async function backfillNameMap() {
  const snippets = await prisma.snippet.findMany({ select: { staffAnswer: true } });
  const distinct = new Set<string>();
  for (const s of snippets) distinct.add(normaliseCommonName(s.staffAnswer));

  console.log(`\n=== Name map backfill ===`);
  console.log(`${distinct.size} distinct staff answers`);

  let i = 0;
  for (const commonName of distinct) {
    i++;
    if (!commonName) continue;

    const existing = await prisma.speciesNameMap.findUnique({ where: { commonName } });
    if (existing) {
      console.log(`[${i}/${distinct.size}] "${commonName}" → cached`);
      continue;
    }

    try {
      const result = await retry(() => resolveCommonName(commonName));
      await prisma.speciesNameMap.create({
        data: {
          commonName,
          scientificName: result.scientificName,
          source: "gbif-match",
          confidence: result.confidence,
        },
      });
      console.log(
        `[${i}/${distinct.size}] "${commonName}" → ${result.scientificName ?? "(unresolved)"} (${result.confidence})`
      );
    } catch (err) {
      console.error(`[${i}/${distinct.size}] "${commonName}" FAILED: ${err instanceof Error ? err.message : err}`);
    }

    await sleep(THROTTLE_MS);
  }
}

async function main() {
  try {
    await backfillBuckets();
    await backfillNameMap();
    console.log(`\nDone.`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
