/**
 * Re-upload the high-quality re-exported snippet clips to the active storage
 * provider (R2 in production) and cache-bust the DB URLs.
 *
 * Context: the live clips were exported via OpenCV's mp4v encoder and then
 * re-encoded to H.264 — two lossy passes. The TRDesk4 export now writes H.264
 * once, straight from source (see reexport_snippets_hq.py). This script pushes
 * those improved files over the existing R2 objects.
 *
 * R2 objects are served with `immutable, max-age=2592000`, so overwriting the
 * same key would let browsers/edge keep serving the stale clip. We therefore
 * bump a `?v=N` query param on Snippet.videoUrl / thumbnailUrl, which both the
 * browser and Cloudflare treat as a fresh resource. The underlying object IS
 * overwritten too, so a cold cache fetches the new bytes.
 *
 * The Snippet row id is preserved (we only touch the URLs), so existing Answers
 * / leaderboard history stay attached.
 *
 * Requires the production storage env in this shell:
 *   STORAGE_PROVIDER=r2 plus R2_ACCOUNT_ID / R2_ACCESS_KEY_ID /
 *   R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME / R2_PUBLIC_URL
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/reupload-snippets-hq.ts -- --dry-run
 *   npx tsx --env-file=.env.local scripts/reupload-snippets-hq.ts -- --limit 2
 *   npx tsx --env-file=.env.local scripts/reupload-snippets-hq.ts
 *
 * Flags:
 *   --from <dir>   Folder holding the re-exported <externalId>/ subfolders.
 *                  Default: the DesktopML exported_snippets path.
 *   --dry-run      Report what would change; upload/write nothing.
 *   --limit N      Process at most N snippets (spot-check).
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { buildPublicUrl, getActiveProvider, uploadThumbnail, uploadVideo } from "./lib/storage";

const prisma = new PrismaClient();

const DEFAULT_FROM =
  "C:\\Users\\Christian Abulhawa\\DesktopML\\exported_snippets";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const DRY = process.argv.includes("--dry-run");
// --all forces re-upload of every row; by default we skip rows whose URL is
// already on the active provider's host (idempotent: safe to re-run, only
// migrates the not-yet-done clips).
const FORCE_ALL = process.argv.includes("--all");
const FROM = arg("from") ?? DEFAULT_FROM;
const LIMIT = arg("limit") ? parseInt(arg("limit")!, 10) : Infinity;

function localVideo(dir: string): string | null {
  const h264 = path.join(dir, "snippet_h264.mp4");
  const plain = path.join(dir, "snippet.mp4");
  if (fs.existsSync(h264)) return h264;
  if (fs.existsSync(plain)) return plain;
  return null;
}

/** Append/increment a ?v=N cache-busting param, basing the version on the
 *  current DB URL so re-runs keep incrementing. */
function bustFrom(cleanUrl: string, existing: string | null): string {
  let v = 1;
  if (existing) {
    const m = /[?&]v=(\d+)/.exec(existing);
    if (m) v = parseInt(m[1], 10);
  }
  const u = new URL(cleanUrl);
  u.searchParams.set("v", String(v + 1));
  return u.toString();
}

async function main() {
  console.log(
    `Storage provider: ${getActiveProvider()} ` +
      `(clips will be served from this host; the DB URLs are repointed to match).`,
  );
  if (!fs.existsSync(FROM)) {
    throw new Error(`--from dir not found: ${FROM}`);
  }

  const rows = await prisma.snippet.findMany({
    select: { id: true, externalId: true, videoUrl: true, thumbnailUrl: true },
    orderBy: { externalId: "asc" },
  });
  const providerHost = new URL(buildPublicUrl("_", "video")).host;
  console.log(
    `DB snippets: ${rows.length}  from: ${FROM}  dryRun: ${DRY}  ` +
      `forceAll: ${FORCE_ALL}  providerHost: ${providerHost}\n`,
  );

  let done = 0, skipped = 0;
  for (const row of rows) {
    if (done >= LIMIT) break;

    if (!FORCE_ALL && row.videoUrl.includes(providerHost)) {
      skipped++;
      continue; // already on the active provider — nothing to do
    }

    const dir = path.join(FROM, row.externalId);
    const vid = localVideo(dir);
    const thumb = path.join(dir, "thumbnail.jpg");
    if (!vid || !fs.existsSync(thumb)) {
      console.warn(`SKIP ${row.externalId}: no re-exported file in ${dir}`);
      skipped++;
      continue;
    }

    if (DRY) {
      const kb = Math.round(fs.statSync(vid).size / 1024);
      console.log(`DRY  ${row.externalId}: would upload ${kb}KB + bust ?v`);
      done++;
      continue;
    }

    const videoClean = await uploadVideo(row.externalId, fs.readFileSync(vid));
    const thumbClean = await uploadThumbnail(row.externalId, fs.readFileSync(thumb));
    const videoUrl = bustFrom(videoClean, row.videoUrl);
    const thumbnailUrl = bustFrom(thumbClean, row.thumbnailUrl);

    await prisma.snippet.update({
      where: { id: row.id },
      data: { videoUrl, thumbnailUrl },
    });
    console.log(`OK   ${row.externalId}: ${videoUrl}`);
    done++;
  }

  console.log(`\nDone. processed=${done}  skipped=${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
