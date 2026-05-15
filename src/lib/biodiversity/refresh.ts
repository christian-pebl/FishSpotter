import { ProbabilityStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchTopSpeciesForBucket } from "./obis";
import { bucketFor, type BucketKey } from "./buckets";
import { normaliseCommonName, resolveCommonName } from "./gbif-match";

const CACHE_TTL_DAYS = 90;
const DEFAULT_THROTTLE_MS = 1100;

export type RefreshLogger = (message: string) => void;

export type BucketRefreshResult = {
  totalBuckets: number;
  fresh: number;
  attempted: number;
  ok: number;
  insufficient: number;
  errored: number;
  durationMs: number;
};

export type NameMapRefreshResult = {
  totalNames: number;
  attempted: number;
  resolved: number;
  unresolved: number;
  durationMs: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function retry<T>(fn: () => Promise<T>, attempts = 3, baseMs = 1000): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await sleep(baseMs * Math.pow(2, i));
    }
  }
  throw lastErr;
}

function keyOf(b: { latBucket: number; lonBucket: number; depthBucket: number; month: number }): string {
  return `${b.latBucket}|${b.lonBucket}|${b.depthBucket}|${b.month}`;
}

async function discoverBuckets(): Promise<Map<string, BucketKey>> {
  const snippets = await prisma.snippet.findMany({
    select: { lat: true, lon: true, depthM: true, recordingDatetime: true },
  });
  const buckets = new Map<string, BucketKey>();
  for (const s of snippets) {
    const b = bucketFor(s);
    if (!b) continue;
    buckets.set(keyOf(b), b);
  }
  return buckets;
}

type ExistingRow = {
  latBucket: number;
  lonBucket: number;
  depthBucket: number;
  month: number;
  status: ProbabilityStatus;
  staleAfter: Date;
};

/** Returns the set of buckets that need work, oldest-staleness-first. */
async function pickBucketsToRefresh(opts: {
  buckets: Map<string, BucketKey>;
  maxBuckets?: number;
  staleOnly?: boolean;
}): Promise<BucketKey[]> {
  const now = new Date();
  const existing = (await prisma.speciesProbability.findMany({
    select: {
      latBucket: true,
      lonBucket: true,
      depthBucket: true,
      month: true,
      status: true,
      staleAfter: true,
    },
  })) as ExistingRow[];

  const existingMap = new Map(existing.map((e) => [keyOf(e), e] as const));

  // Priority key: lower = higher priority.
  //   missing rows  → -Infinity (do these first if not staleOnly)
  //   ERROR rows    → 0
  //   stale OK rows → staleAfter timestamp (oldest first)
  //   fresh OK rows → skip
  const candidates: Array<{ bucket: BucketKey; priority: number }> = [];
  for (const [k, bucket] of opts.buckets) {
    const e = existingMap.get(k);
    if (!e) {
      if (opts.staleOnly) continue;
      candidates.push({ bucket, priority: -Infinity });
    } else if (e.status === "ERROR") {
      candidates.push({ bucket, priority: 0 });
    } else if (e.staleAfter < now) {
      candidates.push({ bucket, priority: e.staleAfter.getTime() });
    }
  }
  candidates.sort((a, b) => a.priority - b.priority);
  const limited = opts.maxBuckets ? candidates.slice(0, opts.maxBuckets) : candidates;
  return limited.map((c) => c.bucket);
}

async function persistBucketResult(
  bucket: BucketKey,
  result: Awaited<ReturnType<typeof fetchTopSpeciesForBucket>>,
): Promise<void> {
  const now = new Date();
  const staleAfter = new Date(now.getTime() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);
  const where = {
    latBucket_lonBucket_depthBucket_month: {
      latBucket: bucket.latBucket,
      lonBucket: bucket.lonBucket,
      depthBucket: bucket.depthBucket,
      month: bucket.month,
    },
  };

  const base = {
    latBucket: bucket.latBucket,
    lonBucket: bucket.lonBucket,
    depthBucket: bucket.depthBucket,
    month: bucket.month,
    source: "obis",
    fetchedAt: now,
    staleAfter,
  };

  if (result.status === "OK") {
    const data = {
      status: ProbabilityStatus.OK,
      errorMessage: null,
      totalRecords: result.totalRecords,
      speciesJson: JSON.stringify(result.species),
    };
    await prisma.speciesProbability.upsert({
      where,
      update: { ...data, fetchedAt: now, staleAfter },
      create: { ...base, ...data },
    });
  } else if (result.status === "INSUFFICIENT_DATA") {
    const data = {
      status: ProbabilityStatus.INSUFFICIENT_DATA,
      errorMessage: null,
      totalRecords: 0,
      speciesJson: "[]",
    };
    await prisma.speciesProbability.upsert({
      where,
      update: { ...data, fetchedAt: now, staleAfter },
      create: { ...base, ...data },
    });
  } else {
    const data = {
      status: ProbabilityStatus.ERROR,
      errorMessage: result.errorMessage,
      totalRecords: 0,
      speciesJson: "[]",
    };
    await prisma.speciesProbability.upsert({
      where,
      update: { ...data, fetchedAt: now, staleAfter },
      create: { ...base, ...data },
    });
  }
}

export async function refreshProbabilityBuckets(opts: {
  maxBuckets?: number;
  staleOnly?: boolean;
  throttleMs?: number;
  log?: RefreshLogger;
}): Promise<BucketRefreshResult> {
  const startedAt = Date.now();
  const log = opts.log ?? (() => {});
  const throttleMs = opts.throttleMs ?? DEFAULT_THROTTLE_MS;

  const allBuckets = await discoverBuckets();
  const targets = await pickBucketsToRefresh({
    buckets: allBuckets,
    maxBuckets: opts.maxBuckets,
    staleOnly: opts.staleOnly,
  });

  log(`${allBuckets.size} unique buckets, ${targets.length} need refresh`);

  const counts = { ok: 0, insufficient: 0, errored: 0 };
  let attempted = 0;

  for (let i = 0; i < targets.length; i++) {
    const bucket = targets[i];
    attempted++;
    log(
      `[${i + 1}/${targets.length}] lat=${bucket.latBucket} lon=${bucket.lonBucket} depth=${bucket.depthBucket} month=${bucket.month}`,
    );
    try {
      const result = await retry(() => fetchTopSpeciesForBucket(bucket));
      await persistBucketResult(bucket, result);
      if (result.status === "OK") {
        counts.ok++;
        log(`  → OK (${result.totalRecords} records, top: ${result.species[0]?.scientificName})`);
      } else if (result.status === "INSUFFICIENT_DATA") {
        counts.insufficient++;
        log(`  → INSUFFICIENT_DATA`);
      } else {
        counts.errored++;
        log(`  → ERROR: ${result.errorMessage}`);
      }
    } catch (err) {
      counts.errored++;
      const msg = err instanceof Error ? err.message : String(err);
      log(`  FAILED: ${msg}`);
      // Persist an ERROR row so the next run retries this bucket without losing
      // sight of it.
      await persistBucketResult(bucket, {
        status: "ERROR",
        errorMessage: msg,
        species: [],
      });
    }
    if (i < targets.length - 1) await sleep(throttleMs);
  }

  return {
    totalBuckets: allBuckets.size,
    fresh: allBuckets.size - targets.length,
    attempted,
    ok: counts.ok,
    insufficient: counts.insufficient,
    errored: counts.errored,
    durationMs: Date.now() - startedAt,
  };
}

export async function refreshNameMap(opts: {
  throttleMs?: number;
  log?: RefreshLogger;
}): Promise<NameMapRefreshResult> {
  const startedAt = Date.now();
  const log = opts.log ?? (() => {});
  const throttleMs = opts.throttleMs ?? DEFAULT_THROTTLE_MS;

  const snippets = await prisma.snippet.findMany({ select: { staffAnswer: true } });
  const distinct = new Set<string>();
  for (const s of snippets) {
    const n = normaliseCommonName(s.staffAnswer);
    if (n) distinct.add(n);
  }

  log(`${distinct.size} distinct staff answers to resolve`);

  let attempted = 0;
  let resolved = 0;
  let unresolved = 0;
  let i = 0;
  for (const commonName of distinct) {
    i++;
    const existing = await prisma.speciesNameMap.findUnique({ where: { commonName } });
    if (existing) {
      log(`[${i}/${distinct.size}] "${commonName}" → cached (${existing.scientificName ?? "unresolved"})`);
      if (existing.scientificName) resolved++;
      else unresolved++;
      continue;
    }
    attempted++;
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
      if (result.scientificName) {
        resolved++;
        log(`[${i}/${distinct.size}] "${commonName}" → ${result.scientificName} (${result.confidence})`);
      } else {
        unresolved++;
        log(`[${i}/${distinct.size}] "${commonName}" → unresolved (${result.confidence})`);
      }
    } catch (err) {
      unresolved++;
      const msg = err instanceof Error ? err.message : String(err);
      log(`[${i}/${distinct.size}] "${commonName}" FAILED: ${msg}`);
    }
    if (i < distinct.size) await sleep(throttleMs);
  }

  return {
    totalNames: distinct.size,
    attempted,
    resolved,
    unresolved,
    durationMs: Date.now() - startedAt,
  };
}
