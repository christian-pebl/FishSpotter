/**
 * Re-encode live snippets that a browser cannot decode (db:fix-codecs).
 *
 * WHY
 * ---
 * On 28 Aug 2026 all 52 Car-Y-Mor clips went live as MPEG-4 Part 2 (`mp4v`)
 * instead of H.264. TRDesk4's exporter pipes frames to `ffmpeg -c:v libx264`
 * only when `shutil.which("ffmpeg")` resolves inside its own process; when it
 * does not, it falls back to `cv2.VideoWriter` with the mp4v fourcc and logs a
 * warning. The clips uploaded fine, served a healthy HTTP 206, carried complete
 * metadata and clean pixels, and rendered as "This clip did not load." in every
 * browser.
 *
 * `npm run check:codecs` detects the condition; this script repairs it.
 *
 * WHAT IT DOES
 * ------------
 * For every Snippet whose live video is not H.264: re-encode to H.264, upload
 * over the same storage key, and bump the `?v=` cache-buster on the DB URL so
 * browsers and the CDN pick up the new bytes.
 *
 * Source preference, in order:
 *   1. SNIPS_DIR/<externalId>/snippet.mp4, the exact bytes that were uploaded,
 *      so no download is needed.
 *   2. The live URL.
 *
 * A NOTE ON QUALITY
 * -----------------
 * This is a second lossy pass over an already-weak mp4v intermediate, which is
 * precisely what the 10 Jun 2026 re-cut existed to stop (see CLAUDE.md "Quality
 * re-cut"). It is the right emergency fix (unplayable beats slightly soft) but
 * it is NOT the best available output. The clean fix is to put ffmpeg on
 * TRDesk4's PATH and re-export these clips from the raw footage, which encodes
 * once at crf 16. The crf 18 / preset slow used here keeps the extra generation
 * loss close to invisible in the meantime.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/fix-unplayable-snippets.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/fix-unplayable-snippets.ts
 *
 * Flags: --dry-run, --limit N, --external <externalId> (comma-separated)
 */
import { PrismaClient } from "@prisma/client";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getActiveProvider, getStorageDriver, uploadVideo } from "./lib/storage";
import { isPlayableCodec } from "./lib/video-codec";

const prisma = new PrismaClient();

const SNIPS_DIR = process.env.SNIPS_DIR ?? path.join(process.cwd(), "Fish Spotter Snips");
const DRY = process.argv.includes("--dry-run");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const LIMIT = Number(arg("limit") ?? "0") || 0;
const ONLY = (arg("external") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** Probe a local path or a remote URL. ffprobe only reads the header either way. */
function probeCodec(target: string): string | null {
  const r = spawnSync(
    "ffprobe",
    [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=codec_name",
      "-of", "csv=p=0",
      target,
    ],
    { encoding: "utf-8" },
  );
  if (r.error || r.status !== 0) return null;
  const name = r.stdout.trim().split(/\r?\n/)[0]?.trim();
  return name ? name.toLowerCase() : null;
}

function transcode(input: string, output: string): void {
  const r = spawnSync(
    "ffmpeg",
    [
      "-y", "-i", input,
      "-c:v", "libx264",
      "-crf", "18",
      "-preset", "slow",
      "-profile:v", "high",
      "-level", "4.0",
      "-pix_fmt", "yuv420p",
      // The exports carry no audio track; -an stops ffmpeg mapping a stream
      // that is not there.
      "-an",
      "-movflags", "+faststart",
      output,
    ],
    { encoding: "utf-8", maxBuffer: 256 * 1024 * 1024 },
  );
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`ffmpeg exit ${r.status}: ${(r.stderr ?? "").slice(-600)}`);
}

/**
 * Bump `?v=N`. The object is overwritten at the same key, so without this the
 * browser and the CDN keep serving the undecodable bytes they already cached.
 */
function bumpCacheBuster(baseUrl: string, oldUrl: string): string {
  const previous = Number(new URL(oldUrl).searchParams.get("v") ?? "1");
  const next = (Number.isFinite(previous) ? previous : 1) + 1;
  const u = new URL(baseUrl);
  u.searchParams.set("v", String(next));
  return u.toString();
}

async function downloadTo(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status} for ${url}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function main() {
  const provider = getActiveProvider();
  const driver = getStorageDriver();
  console.log(`Storage provider: ${provider}   dryRun=${DRY}`);

  const where = ONLY.length > 0 ? { externalId: { in: ONLY } } : {};
  const snippets = await prisma.snippet.findMany({
    where,
    select: { id: true, externalId: true, videoUrl: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`Scanning ${snippets.length} snippet(s) for a non-H.264 video stream...`);

  const broken: { id: string; externalId: string; videoUrl: string; codec: string }[] = [];
  for (const s of snippets) {
    const codec = probeCodec(s.videoUrl);
    if (codec === null) {
      console.warn(`  ? ${s.externalId}: could not probe, skipping`);
      continue;
    }
    if (!isPlayableCodec(codec)) broken.push({ ...s, codec });
  }

  console.log(`${broken.length} unplayable clip(s) found.`);
  if (broken.length === 0) {
    await prisma.$disconnect();
    return;
  }

  const targets = LIMIT > 0 ? broken.slice(0, LIMIT) : broken;
  if (targets.length !== broken.length) {
    console.log(`--limit ${LIMIT}: repairing the first ${targets.length}.`);
  }

  if (DRY) {
    for (const t of targets) console.log(`  DRY ${t.externalId} (${t.codec})`);
    console.log("Dry run: nothing uploaded, nothing written to the DB.");
    await prisma.$disconnect();
    return;
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fishspotter-recode-"));
  let fixed = 0;
  const failures: { externalId: string; error: string }[] = [];

  for (const [i, t] of targets.entries()) {
    const label = `[${i + 1}/${targets.length}] ${t.externalId}`;
    const local = path.join(SNIPS_DIR, t.externalId, "snippet.mp4");
    const hasLocal = fs.existsSync(local);
    const input = hasLocal ? local : path.join(tmp, `${t.externalId}.in.mp4`);
    const output = path.join(tmp, `${t.externalId}.h264.mp4`);
    try {
      if (!hasLocal) {
        console.log(`${label}: no local copy, downloading...`);
        await downloadTo(t.videoUrl, input);
      }
      transcode(input, output);

      const after = probeCodec(output);
      if (!isPlayableCodec(after)) {
        throw new Error(`re-encode produced ${after ?? "an unprobeable file"}`);
      }

      const body = fs.readFileSync(output);
      await uploadVideo(t.externalId, body);

      // Rebuild from the driver rather than editing the old string, so a
      // provider switch is reflected instead of silently pointing at whichever
      // bucket the row happened to be in before.
      const newUrl = bumpCacheBuster(driver.buildPublicUrl(t.externalId, "video"), t.videoUrl);
      await prisma.snippet.update({ where: { id: t.id }, data: { videoUrl: newUrl } });

      const inKb = (fs.statSync(input).size / 1024).toFixed(0);
      const outKb = (body.length / 1024).toFixed(0);
      console.log(`${label}: ${t.codec} -> h264, ${inKb}KB -> ${outKb}KB`);
      fixed++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`${label}: FAILED ${msg}`);
      failures.push({ externalId: t.externalId, error: msg });
    } finally {
      if (!hasLocal && fs.existsSync(input)) fs.unlinkSync(input);
      if (fs.existsSync(output)) fs.unlinkSync(output);
    }
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`Repaired ${fixed}/${targets.length}. Failed ${failures.length}.`);
  for (const f of failures) console.log(`  - ${f.externalId}: ${f.error}`);
  console.log("Verify with: npm run check:codecs");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
