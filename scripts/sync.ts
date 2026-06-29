/**
 * Incremental snippet sync (db:sync).
 *
 * Reads the Fish Spotter Snips folders (SNIPS_DIR env, or ./Fish Spotter Snips)
 * and, for each folder that is NEW or CHANGED since the last run:
 *   - re-uploads snippet.mp4 + thumbnail.jpg to the active storage provider and
 *     cache-busts the DB URL — but ONLY when the video bytes actually changed
 *     (a re-cut). When only bbox_data.json / metadata.json changed (the editor's
 *     in-place "rewrite manual track" path), the media is left untouched.
 *   - upserts the Snippet row (site/.../bboxJson/manualTrackJson) on externalId.
 *
 * "Changed" is tracked by a local manifest (.sync-manifest.json) of per-folder
 * signatures (size+mtime of snippet.mp4 / bbox_data.json / metadata.json), so a
 * re-run after a single new or edited snip touches just that one. This is what
 * DesktopML's fishspotter_sync.py invokes (npm run db:sync) after every export.
 *
 * seed.ts remains the one-time, upload-everything bootstrap; sync.ts is the
 * cheap, idempotent, repeat-after-every-export path.
 *
 * Run:
 *   npm run db:sync
 *   SNIPS_DIR="G:\\...\\Fish Spotter Snips" npm run db:sync
 * Flags: --all (ignore manifest, resync everything), --dry-run, --limit N
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import {
  getActiveProvider,
  getStorageDriver,
  uploadThumbnail,
  uploadVideo,
} from "./lib/storage";
import { isSnippetExcluded } from "../src/lib/snippet-blocklist";

const prisma = new PrismaClient();

const SNIPS_DIR = process.env.SNIPS_DIR ?? path.join(process.cwd(), "Fish Spotter Snips");
const MEDIA_OUT = path.join(process.cwd(), "public", "media", "snippets");
const MANIFEST_PATH = path.join(process.cwd(), ".sync-manifest.json");

const DRY = process.argv.includes("--dry-run");
const ALL = process.argv.includes("--all");
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const LIMIT = arg("limit") ? parseInt(arg("limit")!, 10) : Infinity;

interface Metadata {
  video_name: string;
  functional_group: string;
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

interface Signature {
  video: string;
  bbox: string;
  meta: string;
}
type Manifest = Record<string, Signature>;

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getVideoPath(snippetDir: string): string | null {
  const h264 = path.join(snippetDir, "snippet_h264.mp4");
  const plain = path.join(snippetDir, "snippet.mp4");
  if (fs.existsSync(h264)) return h264;
  if (fs.existsSync(plain)) return plain;
  return null;
}

function getReferenceAnswer(meta: Metadata): string {
  return (
    meta.species_name ??
    meta.species ??
    meta.taxon_name ??
    meta.common_name ??
    meta.functional_group ??
    "Unknown"
  );
}

function statSig(p: string | null): string {
  if (!p) return "";
  try {
    const s = fs.statSync(p);
    return `${s.size}:${Math.round(s.mtimeMs)}`;
  } catch {
    return "";
  }
}

function folderSignature(dir: string): Signature {
  return {
    video: statSig(getVideoPath(dir)),
    bbox: statSig(path.join(dir, "bbox_data.json")),
    meta: statSig(path.join(dir, "metadata.json")),
  };
}

function loadManifest(): Manifest {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8")) as Manifest;
  } catch {
    return {};
  }
}

function saveManifest(m: Manifest) {
  if (DRY) return;
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2));
}

function shouldUseLocalFallback(): boolean {
  try {
    getStorageDriver();
    return false;
  } catch {
    return true;
  }
}

/** Append/increment a ?v=N cache-busting param so the edge/browser refetches a
 *  re-cut clip whose object was overwritten in place. */
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

function readTracking(bboxPath: string): { bboxJson: string | null; manualTrackJson: string | null } {
  if (!fs.existsSync(bboxPath)) return { bboxJson: null, manualTrackJson: null };
  const bboxData = JSON.parse(fs.readFileSync(bboxPath, "utf-8"));
  const bboxJson = JSON.stringify(bboxData.bboxes ?? bboxData);
  const pts = bboxData?.manual_track?.points;
  const manualTrackJson =
    Array.isArray(pts) && pts.length > 0 ? JSON.stringify(pts) : null;
  return { bboxJson, manualTrackJson };
}

async function main() {
  if (!fs.existsSync(SNIPS_DIR)) {
    throw new Error(`SNIPS_DIR not found: ${SNIPS_DIR}`);
  }
  const useLocal = shouldUseLocalFallback();
  if (useLocal) {
    ensureDir(MEDIA_OUT);
    console.warn("No storage provider configured. Using local public/media/snippets.");
  } else {
    console.log(`Storage provider: ${getActiveProvider()}`);
  }

  const manifest = loadManifest();
  const dirs = fs
    .readdirSync(SNIPS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  console.log(`Scanning ${dirs.length} folders in ${SNIPS_DIR} (dryRun=${DRY}, all=${ALL})`);

  let processed = 0;
  let skipped = 0;

  for (const folderName of dirs) {
    if (processed >= LIMIT) break;

    // Intentionally-excluded snips (src/lib/snippet-blocklist.ts) are never
    // (re)added to the app, so don't upload media or upsert a row for them.
    if (isSnippetExcluded(folderName)) {
      console.log(`SKIP (excluded) ${folderName}`);
      skipped++;
      continue;
    }

    const dir = path.join(SNIPS_DIR, folderName);
    const metaPath = path.join(dir, "metadata.json");
    const bboxPath = path.join(dir, "bbox_data.json");
    const videoPath = getVideoPath(dir);
    const thumbPath = path.join(dir, "thumbnail.jpg");
    if (!fs.existsSync(metaPath) || !videoPath || !fs.existsSync(thumbPath)) {
      continue; // not a complete snip folder
    }

    const sig = folderSignature(dir);
    const prev = manifest[folderName];
    const existing = await prisma.snippet.findUnique({
      where: { externalId: folderName },
      select: { id: true, videoUrl: true, thumbnailUrl: true, excluded: true },
    });

    const isNew = !existing;
    const unchanged =
      !ALL &&
      !!prev &&
      !!existing &&
      prev.video === sig.video &&
      prev.bbox === sig.bbox &&
      prev.meta === sig.meta;
    if (unchanged) {
      skipped++;
      continue;
    }

    const meta: Metadata = JSON.parse(fs.readFileSync(metaPath, "utf-8"));

    // Deselected via TRDesk4's "Exclude from FishSpotter" gallery toggle. The
    // flag lives in the snip's metadata.json (travels with it via Drive); we
    // mirror it into Snippet.excluded so excludeBlockedSnippetsWhere() hides the
    // snip on every user-facing surface. Reversible: un-exclude in TRDesk4 +
    // re-sync flips it back (the row below is upserted with excluded: false).
    const fsExcluded =
      (meta as { fishspotter_excluded?: boolean }).fishspotter_excluded === true;
    if (fsExcluded) {
      if (existing) {
        if (!existing.excluded && !DRY) {
          await prisma.snippet.update({
            where: { externalId: folderName },
            data: { excluded: true },
          });
        }
        console.log(`${DRY ? "DRY  " : "HIDE "}${folderName} (fishspotter_excluded)`);
        processed++;
      } else {
        // Never synced and already flagged — nothing to upload or hide.
        console.log(`SKIP (excluded, not in DB) ${folderName}`);
        skipped++;
      }
      manifest[folderName] = sig;
      continue;
    }

    // Re-upload media only for genuinely new snips, or when a PRIOR signature
    // shows the clip bytes changed (a re-cut). When the row already exists but
    // we have no prior signature (the first sync after deploy), assume the live
    // media is current and just backfill the DB columns + seed the manifest;
    // re-uploading every clip on the first run would needlessly cache-bust them.
    const videoChanged = isNew || (!!prev && prev.video !== sig.video);

    const { bboxJson, manualTrackJson } = readTracking(bboxPath);

    let videoUrl: string;
    let thumbnailUrl: string;

    if (useLocal) {
      const outDir = path.join(MEDIA_OUT, folderName);
      if (!DRY) {
        ensureDir(outDir);
        fs.copyFileSync(videoPath, path.join(outDir, "snippet.mp4"));
        fs.copyFileSync(thumbPath, path.join(outDir, "thumbnail.jpg"));
      }
      videoUrl = `/media/snippets/${folderName}/snippet.mp4`;
      thumbnailUrl = `/media/snippets/${folderName}/thumbnail.jpg`;
    } else if (videoChanged) {
      if (DRY) {
        videoUrl = existing?.videoUrl ?? "(new upload)";
        thumbnailUrl = existing?.thumbnailUrl ?? "(new upload)";
      } else {
        const vClean = await uploadVideo(folderName, fs.readFileSync(videoPath));
        const tClean = await uploadThumbnail(folderName, fs.readFileSync(thumbPath));
        videoUrl = bustFrom(vClean, existing?.videoUrl ?? null);
        thumbnailUrl = bustFrom(tClean, existing?.thumbnailUrl ?? null);
      }
    } else {
      // Media unchanged (editor rewrite path): keep the existing URLs and only
      // refresh the DB tracking/metadata fields below.
      videoUrl = existing!.videoUrl;
      thumbnailUrl = existing!.thumbnailUrl;
    }

    if (DRY) {
      console.log(
        `DRY  ${folderName}: ${isNew ? "new" : "update"}${videoChanged ? " +media" : ""}` +
          `${manualTrackJson ? " +manualTrack" : ""}`,
      );
      manifest[folderName] = sig;
      processed++;
      continue;
    }

    const data = {
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
      manualTrackJson,
      excluded: false, // reaching here means not fishspotter_excluded; re-include flips a previously-hidden snip back
    };
    await prisma.snippet.upsert({
      where: { externalId: folderName },
      create: { externalId: folderName, ...data },
      update: data,
    });

    manifest[folderName] = sig;
    processed++;
    console.log(
      `${isNew ? "NEW " : "UPD "}${folderName}${videoChanged ? " (media)" : ""}` +
        `${manualTrackJson ? " [manualTrack]" : ""}`,
    );
  }

  saveManifest(manifest);
  console.log(`\nSync complete. processed=${processed} skipped=${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
