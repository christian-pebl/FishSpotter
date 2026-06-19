/**
 * Seed / sync: reads Fish Spotter Snips folders, uploads media to the active
 * storage provider (Supabase by default, Cloudflare R2 if STORAGE_PROVIDER=r2),
 * and upserts snippet records into the database.
 *
 * Folder source:
 *   SNIPS_DIR env var if set (e.g. the Google Drive "Fish Spotter Snips" folder
 *   that TRDesk4 exports into), otherwise <repo>/Fish Spotter Snips.
 *
 * Modes:
 *   npm run db:seed   -> process every folder (re-upserts all; full reseed)
 *   npm run db:sync   -> incremental (--incremental): only folders not already
 *                        in the DB. Add --force to reprocess everything.
 *
 * Upsert is keyed on the folder name (externalId), so runs are idempotent and
 * safe to fire after every export.
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import {
  buildPublicUrl,
  getActiveProvider,
  getStorageDriver,
  uploadThumbnail,
  uploadVideo,
} from "./lib/storage";

const prisma = new PrismaClient();

const SNIPS_DIR = process.env.SNIPS_DIR
  ? path.resolve(process.env.SNIPS_DIR)
  : path.join(process.cwd(), "Fish Spotter Snips");
const MEDIA_OUT = path.join(process.cwd(), "public", "media", "snippets");

// Incremental sync: skip folders already present in the DB (unless --force).
const INCREMENTAL =
  process.argv.includes("--incremental") && !process.argv.includes("--force");

interface Metadata {
  video_name: string;
  track_id: number;
  functional_group: string;
  lowest_taxa?: string;
  species?: string;
  species_name?: string;
  taxon_name?: string;
  common_name?: string;
  deployment: string;
  site: string;
  depth_m?: number;
  latitude?: number;
  longitude?: number;
  recording_datetime?: string;
  [key: string]: unknown;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getVideoPath(snippetDir: string): string | null {
  const h264 = path.join(snippetDir, "snippet_h264.mp4");
  const plain = path.join(snippetDir, "snippet.mp4");
  if (fs.existsSync(h264)) return h264;
  if (fs.existsSync(plain)) return plain;
  return null;
}

function getReferenceAnswer(meta: Metadata): string {
  // Prefer the most specific identification. lowest_taxa is the staff-entered
  // "Lowest Identifiable Taxa" from TRDesk4; functional_group is the coarse
  // fallback. Empty / whitespace values are skipped so a blank field can't win.
  const candidates = [
    meta.lowest_taxa,
    meta.species_name,
    meta.species,
    meta.taxon_name,
    meta.common_name,
    meta.functional_group,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim() !== "") return c.trim();
  }
  return "Unknown";
}

function shouldUseLocalFallback(): boolean {
  // Local fallback only kicks in when storage env vars for the chosen
  // provider are missing entirely. With a provider configured, we always
  // upload — even on dev — because the DB row points at a public URL.
  try {
    getStorageDriver();
    return false;
  } catch {
    return true;
  }
}

async function main() {
  const useLocal = shouldUseLocalFallback();
  if (useLocal) {
    ensureDir(MEDIA_OUT);
    console.warn(
      "No storage provider configured. Falling back to local public/media/snippets.",
    );
  } else {
    console.log(`Uploading to ${getActiveProvider()} storage.`);
  }

  if (!fs.existsSync(SNIPS_DIR)) {
    console.error(`SNIPS_DIR does not exist: ${SNIPS_DIR}`);
    console.error("Set the SNIPS_DIR env var to your snippets folder.");
    return;
  }
  console.log(`Reading snippet folders from: ${SNIPS_DIR}`);

  let existingIds = new Set<string>();
  if (INCREMENTAL) {
    const rows = await prisma.snippet.findMany({ select: { externalId: true } });
    existingIds = new Set(rows.map((r) => r.externalId));
    console.log(`Incremental mode: ${existingIds.size} snippet(s) already in DB.`);
  }

  const dirs = fs.readdirSync(SNIPS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  console.log(`Found ${dirs.length} snippet folders.`);

  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const folderName of dirs) {
    if (INCREMENTAL && existingIds.has(folderName)) {
      skipped++;
      continue;
    }

    try {
      const snippetDir = path.join(SNIPS_DIR, folderName);
      const metaPath = path.join(snippetDir, "metadata.json");
      const bboxPath = path.join(snippetDir, "bbox_data.json");

      if (!fs.existsSync(metaPath)) {
        console.warn(`Skip ${folderName}: no metadata.json`);
        skipped++;
        continue;
      }

      const videoPath = getVideoPath(snippetDir);
      const thumbPath = path.join(snippetDir, "thumbnail.jpg");
      if (!videoPath || !fs.existsSync(thumbPath)) {
        console.warn(`Skip ${folderName}: missing video or thumbnail`);
        skipped++;
        continue;
      }

      const meta: Metadata = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      let bboxJson: string | null = null;
      if (fs.existsSync(bboxPath)) {
        const bboxData = JSON.parse(fs.readFileSync(bboxPath, "utf-8"));
        bboxJson = JSON.stringify(bboxData.bboxes ?? bboxData);
      }

      let videoUrl: string;
      let thumbnailUrl: string;

      if (useLocal) {
        const outDir = path.join(MEDIA_OUT, folderName);
        ensureDir(outDir);
        fs.copyFileSync(videoPath, path.join(outDir, "snippet.mp4"));
        fs.copyFileSync(thumbPath, path.join(outDir, "thumbnail.jpg"));
        videoUrl = `/media/snippets/${folderName}/snippet.mp4`;
        thumbnailUrl = `/media/snippets/${folderName}/thumbnail.jpg`;
      } else {
        const videoBuffer = fs.readFileSync(videoPath);
        const thumbBuffer = fs.readFileSync(thumbPath);
        videoUrl = await uploadVideo(folderName, videoBuffer);
        thumbnailUrl = await uploadThumbnail(folderName, thumbBuffer);
      }

      await prisma.snippet.upsert({
        where: { externalId: folderName },
        create: {
          externalId: folderName,
          videoUrl,
          thumbnailUrl,
          site: meta.site ?? "Unknown",
          deployment: meta.deployment ?? "Unknown",
          depthM: meta.depth_m ?? null,
          lat: meta.latitude ?? null,
          lon: meta.longitude ?? null,
          recordingDatetime: meta.recording_datetime ?? null,
          staffAnswer: getReferenceAnswer(meta),
          bboxJson,
        },
        update: {
          videoUrl,
          thumbnailUrl,
          site: meta.site ?? "Unknown",
          deployment: meta.deployment ?? "Unknown",
          depthM: meta.depth_m ?? null,
          lat: meta.latitude ?? null,
          lon: meta.longitude ?? null,
          recordingDatetime: meta.recording_datetime ?? null,
          staffAnswer: getReferenceAnswer(meta),
          bboxJson,
        },
      });
      synced++;
      console.log(`Synced: ${folderName}`);
    } catch (err) {
      failed++;
      console.warn(`Failed ${folderName}: ${(err as Error).message}`);
    }
  }

  console.log(`Done. synced=${synced} skipped=${skipped} failed=${failed}`);
  // Reference buildPublicUrl so tree-shake keeps it exported for future callers.
  void buildPublicUrl;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
