/**
 * One-time seed: reads Fish Spotter Snips folders, uploads media to Supabase Storage
 * when configured, and inserts snippet records into the database.
 * Run: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

const SNIPS_DIR = path.join(process.cwd(), "Fish Spotter Snips");
const MEDIA_OUT = path.join(process.cwd(), "public", "media", "snippets");
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "snippets";

interface Metadata {
  video_name: string;
  track_id: number;
  functional_group: string;
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

function getSupabaseClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getPublicStorageUrl(objectPath: string) {
  if (!SUPABASE_URL) {
    throw new Error("SUPABASE_URL is required to build public storage URLs.");
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${objectPath}`;
}

async function uploadToStorage(
  supabase: SupabaseClient,
  objectPath: string,
  filePath: string,
  contentType: string
) {
  const fileBuffer = fs.readFileSync(filePath);
  const { error } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).upload(objectPath, fileBuffer, {
    upsert: true,
    contentType,
  });

  if (error) {
    throw error;
  }

  return getPublicStorageUrl(objectPath);
}

function getVideoPath(snippetDir: string): string | null {
  const h264 = path.join(snippetDir, "snippet_h264.mp4");
  const plain = path.join(snippetDir, "snippet.mp4");
  if (fs.existsSync(h264)) return h264;
  if (fs.existsSync(plain)) return plain;
  return null;
}

async function main() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    ensureDir(MEDIA_OUT);
    console.warn("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set. Falling back to local public/media/snippets.");
  }

  const dirs = fs.readdirSync(SNIPS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  console.log(`Found ${dirs.length} snippet folders.`);

  for (const folderName of dirs) {
    const snippetDir = path.join(SNIPS_DIR, folderName);
    const metaPath = path.join(snippetDir, "metadata.json");
    const bboxPath = path.join(snippetDir, "bbox_data.json");

    if (!fs.existsSync(metaPath)) {
      console.warn(`Skip ${folderName}: no metadata.json`);
      continue;
    }

    const videoPath = getVideoPath(snippetDir);
    const thumbPath = path.join(snippetDir, "thumbnail.jpg");
    if (!videoPath || !fs.existsSync(thumbPath)) {
      console.warn(`Skip ${folderName}: missing video or thumbnail`);
      continue;
    }

    const meta: Metadata = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    let bboxJson: string | null = null;
    if (fs.existsSync(bboxPath)) {
      const bboxData = JSON.parse(fs.readFileSync(bboxPath, "utf-8"));
      bboxJson = JSON.stringify(bboxData.bboxes ?? bboxData);
    }

    const videoExt = path.extname(videoPath);
    let videoUrl: string;
    let thumbnailUrl: string;

    if (supabase) {
      const videoObjectPath = `${folderName}/snippet${videoExt}`;
      const thumbObjectPath = `${folderName}/thumbnail.jpg`;
      videoUrl = await uploadToStorage(supabase, videoObjectPath, videoPath, "video/mp4");
      thumbnailUrl = await uploadToStorage(supabase, thumbObjectPath, thumbPath, "image/jpeg");
    } else {
      const outDir = path.join(MEDIA_OUT, folderName);
      ensureDir(outDir);

      const videoDest = path.join(outDir, `snippet${videoExt}`);
      const thumbDest = path.join(outDir, "thumbnail.jpg");
      fs.copyFileSync(videoPath, videoDest);
      fs.copyFileSync(thumbPath, thumbDest);

      videoUrl = `/media/snippets/${folderName}/snippet${videoExt}`;
      thumbnailUrl = `/media/snippets/${folderName}/thumbnail.jpg`;
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
        staffAnswer: meta.functional_group ?? "Unknown",
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
        staffAnswer: meta.functional_group ?? "Unknown",
        bboxJson,
      },
    });
    console.log(`Seeded: ${folderName}`);
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
