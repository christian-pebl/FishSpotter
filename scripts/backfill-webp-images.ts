/**
 * Route C: backfill PEBL-hosted WebP derivatives for SpeciesImage rows.
 *
 * For each row missing `webpUrl`, downloads the source photo, transcodes it to
 * WebP at the two UI sizes (240px thumb / 500px medium), uploads both to the
 * active storage provider (R2 in production — see scripts/lib/storage.ts), and
 * records the public URLs on the row. Idempotent: only touches rows where
 * `webpUrl IS NULL` unless --force is passed.
 *
 * This runs OUT of band from the weekly images cron on purpose: sharp encoding
 * + two uploads per photo would blow the cron's 50s budget. Run it manually
 * after a refresh, or on a schedule via GitHub Actions (no Vercel time limit).
 *
 *   npm run db:backfill-webp                          # all rows missing webpUrl
 *   npm run db:backfill-webp -- --species "Labrus mixtus"
 *   npm run db:backfill-webp -- --limit 20            # cap rows this run
 *   npm run db:backfill-webp -- --dry-run             # transcode but don't upload/write
 *   npm run db:backfill-webp -- --force               # re-transcode rows that already have webp
 *   npm run db:backfill-webp -- --quality 82
 *
 * Requires storage creds for the active provider (STORAGE_PROVIDER + R2_* or
 * Supabase service role) and the Postgres connection, all from .env.local.
 */
import { PrismaClient } from "@prisma/client";
import { getStorageDriver, uploadSpeciesImage } from "./lib/storage";
import {
  DEFAULT_WEBP_QUALITY,
  downloadImage,
  sourceHash,
  transcodeAllSizes,
} from "./lib/transcode-image";

const prisma = new PrismaClient();

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const species = argValue("--species");
  const limitRaw = Number(argValue("--limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : undefined;
  const qualityRaw = Number(argValue("--quality"));
  const quality = Number.isFinite(qualityRaw) && qualityRaw > 0 ? qualityRaw : DEFAULT_WEBP_QUALITY;

  // Fail fast if storage isn't configured, BEFORE downloading/encoding anything
  // — unless we're only dry-running (which never touches storage).
  // getStorageDriver() throws on missing provider creds.
  if (!dryRun) {
    console.log(`Storage provider: ${getStorageDriver().provider}`);
  }

  const rows = await prisma.speciesImage.findMany({
    where: {
      ...(force ? {} : { webpUrl: null }),
      ...(species ? { scientificName: species } : {}),
    },
    orderBy: [{ curated: "desc" }, { scientificName: "asc" }],
    ...(limit ? { take: limit } : {}),
    select: { id: true, scientificName: true, url: true, sourceUrl: true },
  });

  console.log(
    `Rows to process: ${rows.length}` +
      `${force ? " (--force: includes already-transcoded)" : " (missing webpUrl)"}` +
      `${dryRun ? " [DRY RUN — no upload/write]" : ""}` +
      `  quality=${quality}\n`,
  );

  let done = 0;
  let failed = 0;
  let savedBytes = 0;

  for (const r of rows) {
    try {
      const src = await downloadImage(r.url);
      const { thumb, medium } = await transcodeAllSizes(src, quality);
      savedBytes += Math.max(0, src.length - thumb.bytes - medium.bytes);

      if (dryRun) {
        done++;
        console.log(
          `  [dry] ${r.scientificName.padEnd(26)} src=${src.length}B ` +
            `thumb=${thumb.bytes}B(${thumb.width}px) medium=${medium.bytes}B(${medium.width}px)`,
        );
        continue;
      }

      // Key by source-URL hash so re-runs overwrite the same objects.
      const hash = sourceHash(r.sourceUrl);
      const [webpThumbUrl, webpUrl] = await Promise.all([
        uploadSpeciesImage(hash, "thumb", thumb.data),
        uploadSpeciesImage(hash, "medium", medium.data),
      ]);

      await prisma.speciesImage.update({
        where: { id: r.id },
        data: { webpUrl, webpThumbUrl },
      });
      done++;
      console.log(
        `  ${r.scientificName.padEnd(26)} thumb=${thumb.bytes}B medium=${medium.bytes}B  -> ${webpUrl}`,
      );
    } catch (e) {
      failed++;
      console.log(`  ${r.scientificName.padEnd(26)} FAILED: ${(e as Error).message}  ${r.url}`);
    }
  }

  console.log(
    `\nDone. processed=${done} failed=${failed}` +
      `${dryRun ? "" : `  (~${Math.round(savedBytes / 1024)} KB saved vs source across processed rows)`}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
