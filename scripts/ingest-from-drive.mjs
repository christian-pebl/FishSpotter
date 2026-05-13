// Unified ingest pipeline: pulls clip folders from the Drive "Fish Spotter Snips"
// directory, copies/uploads media, and upserts Snippet rows in the database.
//
// One command keeps the app in sync with the Drive folder.
// Idempotent — re-run any time.
//
// Usage:
//   node scripts/ingest-from-drive.mjs                  # copies media to ./public/media/snippets (local + Vercel-via-git)
//   node scripts/ingest-from-drive.mjs --storage        # uploads media to Supabase Storage instead (no git push needed)
//   node scripts/ingest-from-drive.mjs --source <path>  # override the Drive path
//   node scripts/ingest-from-drive.mjs --dry-run        # show what would happen, change nothing

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// Auto-load env from .env.local (alongside .env which Prisma already auto-loads)
// so callers don't need `--env-file=.env.local`.
(function loadEnvLocal() {
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const [, key, raw] = m;
    if (process.env[key]) continue; // don't override explicitly-set vars
    let val = raw.trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
})();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");

const args = process.argv.slice(2);
const USE_STORAGE = args.includes("--storage");
const DRY_RUN = args.includes("--dry-run");
const SOURCE =
  args.find((a) => a.startsWith("--source="))?.slice("--source=".length) ??
  String.raw`G:\.shortcut-targets-by-id\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\Ocean\08 - Data\01 - SubCam data\Fish Spotter Snips`;

const PUBLIC_MEDIA_DIR = path.join(REPO_ROOT, "public", "media", "snippets");
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "snippets";

// ─── Helpers ────────────────────────────────────────────────────────────────

function pickReferenceAnswer(meta) {
  return (
    meta.lowest_taxa ||
    meta.species_name ||
    meta.species ||
    meta.taxon_name ||
    meta.common_name ||
    meta.functional_group ||
    "Unknown"
  );
}

function pickVideoFile(snippetDir) {
  // Prefer H.264 if already transcoded; otherwise use the raw mp4
  const h264 = path.join(snippetDir, "snippet_h264.mp4");
  const plain = path.join(snippetDir, "snippet.mp4");
  if (fs.existsSync(h264)) return h264;
  if (fs.existsSync(plain)) return plain;
  return null;
}

function copyIfDifferent(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (fs.existsSync(dst)) {
    const a = fs.statSync(src), b = fs.statSync(dst);
    if (a.size === b.size && a.mtimeMs <= b.mtimeMs) return false; // identical-ish, skip
  }
  fs.copyFileSync(src, dst);
  return true;
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("ERROR: --storage requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env");
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function ensureBucket(supabase) {
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) throw listErr;
  if (buckets.find((b) => b.name === BUCKET)) return;
  console.log(`  creating Storage bucket "${BUCKET}" (public)…`);
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (error) throw error;
}

async function uploadToStorage(supabase, objectPath, filePath, contentType) {
  const buf = fs.readFileSync(filePath);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, buf, { upsert: true, contentType });
  if (error) throw error;
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`;
}

// ─── Main ───────────────────────────────────────────────────────────────────

const prisma = new PrismaClient();

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`ERROR: source folder not found: ${SOURCE}`);
    process.exit(1);
  }
  console.log(`Source: ${SOURCE}`);
  console.log(`Mode:   ${USE_STORAGE ? "Supabase Storage" : "public/media (local + git)"}${DRY_RUN ? " (DRY RUN)" : ""}`);

  const supabase = USE_STORAGE && !DRY_RUN ? getSupabaseClient() : null;
  if (supabase) await ensureBucket(supabase);

  const folders = fs
    .readdirSync(SOURCE, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  console.log(`\nFound ${folders.length} folder(s) on Drive.`);

  const existing = await prisma.snippet.findMany({ select: { externalId: true } });
  const existingSet = new Set(existing.map((s) => s.externalId));
  const newOnes = folders.filter((f) => !existingSet.has(f));
  const existingOnes = folders.filter((f) => existingSet.has(f));
  console.log(`  ${newOnes.length} new (not yet in DB), ${existingOnes.length} already known.\n`);

  let created = 0, updated = 0, skipped = 0;

  for (const folder of folders) {
    const snippetDir = path.join(SOURCE, folder);
    const metaPath = path.join(snippetDir, "metadata.json");
    const bboxPath = path.join(snippetDir, "bbox_data.json");
    const videoSrc = pickVideoFile(snippetDir);
    const thumbSrc = path.join(snippetDir, "thumbnail.jpg");

    if (!fs.existsSync(metaPath) || !videoSrc || !fs.existsSync(thumbSrc)) {
      console.log(`  ✗ ${folder.slice(0, 55)}…   missing files, skipping`);
      skipped++;
      continue;
    }

    const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    const bboxJson = fs.existsSync(bboxPath)
      ? JSON.stringify(JSON.parse(fs.readFileSync(bboxPath, "utf-8")).bboxes ?? null)
      : null;
    const staffAnswer = pickReferenceAnswer(meta);
    const videoExt = path.extname(videoSrc); // .mp4

    let videoUrl, thumbnailUrl;
    if (USE_STORAGE) {
      // Storage path: <folder>/snippet.mp4 + <folder>/thumbnail.jpg
      const videoKey = `${folder}/snippet${videoExt}`;
      const thumbKey = `${folder}/thumbnail.jpg`;
      if (!DRY_RUN) {
        videoUrl = await uploadToStorage(supabase, videoKey, videoSrc, "video/mp4");
        thumbnailUrl = await uploadToStorage(supabase, thumbKey, thumbSrc, "image/jpeg");
      } else {
        videoUrl = `(Storage)/${videoKey}`;
        thumbnailUrl = `(Storage)/${thumbKey}`;
      }
    } else {
      const outDir = path.join(PUBLIC_MEDIA_DIR, folder);
      if (!DRY_RUN) {
        copyIfDifferent(videoSrc, path.join(outDir, `snippet${videoExt}`));
        copyIfDifferent(thumbSrc, path.join(outDir, "thumbnail.jpg"));
      }
      videoUrl = `/media/snippets/${folder}/snippet${videoExt}`;
      thumbnailUrl = `/media/snippets/${folder}/thumbnail.jpg`;
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
      staffAnswer,
      bboxJson,
    };

    if (DRY_RUN) {
      const action = existingSet.has(folder) ? "would update" : "would create";
      console.log(`  ◦ ${folder.slice(0, 55)}…   ${action}  staffAnswer=${staffAnswer}`);
      continue;
    }

    const before = await prisma.snippet.findUnique({ where: { externalId: folder } });
    if (before) {
      await prisma.snippet.update({ where: { externalId: folder }, data });
      updated++;
      console.log(`  ↻ ${folder.slice(0, 55)}…   updated`);
    } else {
      await prisma.snippet.create({ data: { externalId: folder, ...data } });
      created++;
      console.log(`  + ${folder.slice(0, 55)}…   CREATED  ${staffAnswer}`);
    }
  }

  console.log(`\nResults: ${created} created, ${updated} updated, ${skipped} skipped${DRY_RUN ? " (dry-run, no DB writes)" : ""}.`);
  if (!USE_STORAGE && !DRY_RUN && created > 0) {
    console.log(`\nMedia copied to: ${PUBLIC_MEDIA_DIR}`);
    console.log("For Vercel to pick up new clips:");
    console.log("  cd FishSpotter-mgtaco-baseline  # or whatever your Vercel-tracked worktree is");
    console.log("  cp -r ../FishSpotter/public/media/snippets/<new-folder> public/media/snippets/");
    console.log("  git add public/media/snippets && git commit && git push");
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
