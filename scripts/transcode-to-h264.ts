/**
 * Transcodes all mp4v-encoded snippet videos to H.264 and re-uploads to Supabase.
 * Run: npx tsx --env-file=.env.local scripts/transcode-to-h264.ts
 */
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync, spawnSync } from "child_process";

const prisma = new PrismaClient();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "snippets";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function getPublicUrl(objectPath: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`;
}

async function downloadFile(url: string, destPath: string) {
  const urlWithoutQuery = url.split("?")[0];
  const res = await fetch(urlWithoutQuery);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const buf = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buf));
}

function detectCodec(videoPath: string): string {
  const result = spawnSync("ffprobe", [
    "-v", "quiet",
    "-select_streams", "v:0",
    "-show_entries", "stream=codec_name",
    "-of", "default=noprint_wrappers=1:nokey=1",
    videoPath,
  ], { encoding: "utf8" });
  return (result.stdout ?? "").trim();
}

async function transcodeToH264(inputPath: string, outputPath: string) {
  const result = spawnSync("ffmpeg", [
    "-y",
    "-i", inputPath,
    "-c:v", "libx264",
    "-crf", "22",
    "-preset", "medium",
    "-profile:v", "high",
    "-level", "4.0",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "faststart",
    outputPath,
  ], { encoding: "utf8", maxBuffer: 100 * 1024 * 1024 });

  if (result.status !== 0) {
    throw new Error(`ffmpeg failed:\n${result.stderr}`);
  }
}

async function uploadToStorage(objectPath: string, filePath: string) {
  const fileBuffer = fs.readFileSync(filePath);
  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, fileBuffer, {
    upsert: true,
    contentType: "video/mp4",
  });
  if (error) throw error;
}

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fishspotter-transcode-"));
  console.log(`Using temp dir: ${tmpDir}`);

  const snippets = await prisma.snippet.findMany({
    select: { id: true, externalId: true, videoUrl: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${snippets.length} snippets.`);

  let transcoded = 0;
  let skipped = 0;
  let failed = 0;

  for (const snippet of snippets) {
    const { id, externalId, videoUrl } = snippet;
    console.log(`\n[${snippets.indexOf(snippet) + 1}/${snippets.length}] ${externalId}`);

    const inputPath = path.join(tmpDir, `${externalId}_input.mp4`);
    const outputPath = path.join(tmpDir, `${externalId}_h264.mp4`);

    try {
      console.log(`  Downloading...`);
      await downloadFile(videoUrl, inputPath);

      const codec = detectCodec(inputPath);
      console.log(`  Codec: ${codec}`);

      if (codec === "h264") {
        console.log(`  Already H.264 — skipping transcode`);
        skipped++;
        // Clean up and continue
        fs.unlinkSync(inputPath);
        continue;
      }

      console.log(`  Transcoding to H.264...`);
      await transcodeToH264(inputPath, outputPath);

      const inputSize = fs.statSync(inputPath).size;
      const outputSize = fs.statSync(outputPath).size;
      console.log(`  Size: ${(inputSize / 1024).toFixed(0)}KB → ${(outputSize / 1024).toFixed(0)}KB`);

      const objectPath = `${externalId}/snippet.mp4`;
      console.log(`  Uploading to ${objectPath}...`);
      await uploadToStorage(objectPath, outputPath);

      const newVideoUrl = `${getPublicUrl(objectPath)}?v=3`;
      await prisma.snippet.update({
        where: { id },
        data: { videoUrl: newVideoUrl },
      });

      console.log(`  Done. New URL: ${newVideoUrl}`);
      transcoded++;
    } catch (err) {
      console.error(`  FAILED: ${err}`);
      failed++;
    } finally {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Transcoded: ${transcoded}`);
  console.log(`Skipped (already H.264): ${skipped}`);
  console.log(`Failed: ${failed}`);

  fs.rmdirSync(tmpDir, { recursive: true } as any);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
