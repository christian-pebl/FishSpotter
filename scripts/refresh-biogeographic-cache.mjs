// Refresh the BiogeographicChecklist cache by querying OBIS for each unique
// (deployment, depth bucket, season) tuple in our snippet data. Currently we
// have a single deployment ("Algapelago") so this runs in seconds.
//
// Usage:
//   node scripts/refresh-biogeographic-cache.mjs            # all deployments, all-year only
//   node scripts/refresh-biogeographic-cache.mjs --seasonal # also fill 4 seasonal buckets
//
// Idempotent — re-running upserts cache rows.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const args = new Set(process.argv.slice(2));
const SEASONAL = args.has("--seasonal");

// ─── OBIS client (inlined; same as src/lib/obis.ts but copied to keep this script standalone-runnable) ───

const OBIS_BASE = "https://api.obis.org/v3";

function buildChecklistUrl(q) {
  const params = new URLSearchParams();
  if (q.geometry) params.set("geometry", q.geometry);
  if (q.depthfrom != null) params.set("depthfrom", String(q.depthfrom));
  if (q.depthto != null) params.set("depthto", String(q.depthto));
  if (q.startdate) params.set("startdate", q.startdate);
  if (q.enddate) params.set("enddate", q.enddate);
  if (q.size != null) params.set("size", String(q.size));
  return `${OBIS_BASE}/checklist?${params.toString()}`;
}

function bboxWkt(lat, lon, halfDegree = 0.5) {
  const lonW = lon - halfDegree, lonE = lon + halfDegree, latS = lat - halfDegree, latN = lat + halfDegree;
  return `POLYGON((${lonW} ${latS}, ${lonE} ${latS}, ${lonE} ${latN}, ${lonW} ${latN}, ${lonW} ${latS}))`;
}

async function fetchAll(q, pageSize = 500, cap = 5000) {
  const all = [];
  let from = 0;
  while (all.length < cap) {
    const url = buildChecklistUrl({ ...q, size: pageSize });
    const fullUrl = `${url}&from=${from}`;
    const res = await fetch(fullUrl);
    if (!res.ok) throw new Error(`OBIS request failed: ${res.status}`);
    const body = await res.json();
    if (!body.results || body.results.length === 0) break;
    all.push(...body.results);
    if (body.results.length < pageSize) break;
    from += pageSize;
  }
  return all.slice(0, cap);
}

// ─── Main ───────────────────────────────────────────────────────────────────

const SEASONS = SEASONAL
  ? [
      { name: "winter", startMonth: 12, endMonth: 2 },
      { name: "spring", startMonth: 3, endMonth: 5 },
      { name: "summer", startMonth: 6, endMonth: 8 },
      { name: "autumn", startMonth: 9, endMonth: 11 },
    ]
  : [];

function pad(n) { return String(n).padStart(2, "0"); }

/** Build a (startdate, enddate) range for an "all-year" or specific-season query. */
function dateRangeFor(season) {
  if (!season) return {}; // all-year: no date filter
  // We want ALL years' data for this season. OBIS only supports a single contiguous range,
  // so we take a wide year window (2000-now) and accept that the date filter is approximate.
  // Months that wrap (winter Dec-Feb) need a nudge.
  const startYear = 2000;
  const endYear = new Date().getFullYear();
  // Use first available date through last; OBIS month-of-year filtering inside this isn't built-in,
  // so we accept the trade: prior is "occurrences in a wide window that overlaps our season".
  // For better seasonality we would loop year-by-year. Skipping that for v1 in favour of simplicity.
  const start = `${startYear}-${pad(season.startMonth)}-01`;
  // Last day of endMonth — pick the 28th to be safe across all months
  const end = `${endYear}-${pad(season.endMonth)}-28`;
  return { startdate: start, enddate: end };
}

async function main() {
  // 1. Discover deployments + their representative coordinates from existing Snippets
  const snippets = await prisma.snippet.findMany({
    where: { lat: { not: null }, lon: { not: null } },
    select: { deployment: true, lat: true, lon: true, depthM: true },
  });
  if (snippets.length === 0) {
    console.log("No snippets with lat/lon — nothing to refresh.");
    return;
  }
  const deployments = new Map(); // name → { lats, lons, depths }
  for (const s of snippets) {
    if (!deployments.has(s.deployment)) {
      deployments.set(s.deployment, { lats: [], lons: [], depths: [] });
    }
    const d = deployments.get(s.deployment);
    d.lats.push(s.lat);
    d.lons.push(s.lon);
    if (s.depthM != null) d.depths.push(s.depthM);
  }

  console.log(`Found ${deployments.size} deployment(s):`);
  for (const [name, d] of deployments) {
    const meanLat = d.lats.reduce((a, b) => a + b, 0) / d.lats.length;
    const meanLon = d.lons.reduce((a, b) => a + b, 0) / d.lons.length;
    const minD = d.depths.length ? Math.min(...d.depths) : 0;
    const maxD = d.depths.length ? Math.max(...d.depths) : 50;
    console.log(`  ${name}: ${meanLat.toFixed(3)},${meanLon.toFixed(3)}  depth ${minD}-${maxD}m`);
  }

  // 2. For each deployment, fetch the all-year checklist + (optionally) seasonal buckets
  for (const [name, d] of deployments) {
    const meanLat = d.lats.reduce((a, b) => a + b, 0) / d.lats.length;
    const meanLon = d.lons.reduce((a, b) => a + b, 0) / d.lons.length;
    // Use a generous depth bucket: 10m below to 10m above observed range
    const minD = Math.max(0, (d.depths.length ? Math.min(...d.depths) : 10) - 10);
    const maxD = (d.depths.length ? Math.max(...d.depths) : 30) + 10;
    const wkt = bboxWkt(meanLat, meanLon, 0.5);

    const buckets = [{ name: "all", season: null }, ...SEASONS.map((s) => ({ name: s.name, season: s }))];

    for (const b of buckets) {
      console.log(`\n→ ${name} / depth ${minD}-${maxD}m / season ${b.name}`);
      const dateRange = dateRangeFor(b.season);
      try {
        const rows = await fetchAll({ geometry: wkt, depthfrom: minD, depthto: maxD, ...dateRange });
        console.log(`  OBIS returned ${rows.length} taxa`);

        const occurrences = {};
        let totalRecords = 0;
        for (const r of rows) {
          if (!r.scientificName) continue;
          const key = r.scientificName;
          occurrences[key] = (occurrences[key] ?? 0) + (r.records ?? 0);
          totalRecords += r.records ?? 0;
        }

        await prisma.biogeographicChecklist.upsert({
          where: {
            deployment_depthBucketMin_depthBucketMax_season: {
              deployment: name,
              depthBucketMin: minD,
              depthBucketMax: maxD,
              season: b.name,
            },
          },
          create: {
            deployment: name,
            depthBucketMin: minD,
            depthBucketMax: maxD,
            season: b.name,
            occurrencesJson: JSON.stringify(occurrences),
            recordCount: totalRecords,
          },
          update: {
            occurrencesJson: JSON.stringify(occurrences),
            recordCount: totalRecords,
            fetchedAt: new Date(),
          },
        });

        // Top 5 for sanity-check
        const top = Object.entries(occurrences)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5);
        console.log("  Top 5:");
        for (const [n, c] of top) console.log(`    ${c.toString().padStart(6)}  ${n}`);
      } catch (e) {
        console.error(`  ERROR: ${e instanceof Error ? e.message : e}`);
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
