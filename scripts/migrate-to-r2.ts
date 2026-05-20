/**
 * One-time migration: copy every Snippet's video + thumbnail from its current
 * storage host (typically Supabase) into Cloudflare R2, then update the DB
 * row to point at the R2 public URL.
 *
 * Why: Supabase Storage egress is the single largest line item once user
 * traffic warms up (5 GB/mo free, then $0.09/GB on Pro). R2 has zero egress
 * fees, so once snippets live there, video plays cost ~nothing.
 *
 * Prerequisites:
 *   1. Provision an R2 bucket (see CLAUDE.md "Cloudflare R2 setup").
 *   2. Set STORAGE_PROVIDER=r2 plus the R2_* env vars in .env.local.
 *   3. Optional: --dry-run prints what would change without writing.
 *
 * Run:
 *   npm run db:migrate-to-r2
 *   npm run db:migrate-to-r2 -- --dry-run
 *   npm run db:migrate-to-r2 -- --limit 3
 *   npm run db:migrate-to-r2 -- --force      (re-upload even if URL already points at R2)
 *
 * Safety:
 *   - Idempotent: skips rows whose videoUrl already lives under the R2 public
 *     host, unless --force is given.
 *   - Updates the DB row only after both uploads (video + thumbnail) succeed.
 *   - Does NOT delete the source Supabase objects. Drop them manually once
 *     a few days of production traffic confirm R2 is serving.
 */

import { PrismaClient } from "@prisma/client";
import { getActiveProvider, getStorageDriver, uploadThumbnail, uploadVideo } from "./lib/storage";

const prisma = new PrismaClient();

interface CliFlags {
  dryRun: boolean;
  force: boolean;
  limit: number | null;
}

function parseFlags(argv: string[]): CliFlags {
  const flags: CliFlags = { dryRun: false, force: false, limit: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") flags.dryRun = true;
    else if (a === "--force") flags.force = true;
    else if (a === "--limit") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error("--limit expects a positive integer");
      }
      flags.limit = n;
    }
  }
  return flags;
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed (${res.status} ${res.statusText}): ${url}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function inferVideoContentType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  return "video/mp4";
}

function inferThumbContentType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));

  if (getActiveProvider() !== "r2") {
    throw new Error(
      `Set STORAGE_PROVIDER=r2 (currently "${getActiveProvider()}") before running this migration.`,
    );
  }

  // Force driver construction so misconfigured env fails fast, not mid-row.
  const driver = getStorageDriver();
  console.log(`Migrating to ${driver.provider}`);
  if (flags.dryRun) console.log("DRY RUN: no uploads, no DB writes will happen.");

  const snippets = await prisma.snippet.findMany({
    select: { id: true, externalId: true, videoUrl: true, thumbnailUrl: true },
    orderBy: { createdAt: "asc" },
    ...(flags.limit ? { take: flags.limit } : {}),
  });

  console.log(`Snippets to consider: ${snippets.length}`);

  const r2PublicPrefix = process.env.R2_PUBLIC_URL?.replace(/\/$/, "") ?? "";

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const s of snippets) {
    const alreadyOnR2 =
      r2PublicPrefix.length > 0 &&
      s.videoUrl.startsWith(r2PublicPrefix) &&
      s.thumbnailUrl.startsWith(r2PublicPrefix);

    if (alreadyOnR2 && !flags.force) {
      console.log(`skip   ${s.externalId} (already on R2)`);
      skipped++;
      continue;
    }

    try {
      console.log(`fetch  ${s.externalId}`);
      const [videoBuf, thumbBuf] = await Promise.all([
        fetchBuffer(s.videoUrl),
        fetchBuffer(s.thumbnailUrl),
      ]);

      if (flags.dryRun) {
        const newVideoUrl = driver.buildPublicUrl(s.externalId, "video");
        const newThumbUrl = driver.buildPublicUrl(s.externalId, "thumbnail");
        console.log(`would  ${s.externalId}: ${videoBuf.length} B video → ${newVideoUrl}`);
        console.log(`would  ${s.externalId}: ${thumbBuf.length} B thumb → ${newThumbUrl}`);
        migrated++;
        continue;
      }

      const newVideoUrl = await uploadVideo(
        s.externalId,
        videoBuf,
        inferVideoContentType(s.videoUrl),
      );
      const newThumbUrl = await uploadThumbnail(
        s.externalId,
        thumbBuf,
        inferThumbContentType(s.thumbnailUrl),
      );

      await prisma.snippet.update({
        where: { id: s.id },
        data: { videoUrl: newVideoUrl, thumbnailUrl: newThumbUrl },
      });

      console.log(`ok     ${s.externalId} → ${newVideoUrl}`);
      migrated++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`FAIL   ${s.externalId}: ${msg}`);
      failed++;
    }
  }

  console.log("");
  console.log(`Migrated: ${migrated}   Skipped: ${skipped}   Failed: ${failed}`);
  if (flags.dryRun) console.log("DRY RUN: no DB writes happened.");
  if (failed > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
