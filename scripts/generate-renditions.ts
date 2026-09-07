/**
 * Backfill the 720p SD rendition for every live clip that does not have one.
 *
 * See `scripts/lib/video-rendition.ts` for how the rendition is encoded and
 * why (720p, CRF 20), and `src/lib/video-rendition-select.ts` for who ends up
 * watching it. This script is the production catch-up: `scripts/sync.ts`
 * generates the rendition going forward, from every new export's local file,
 * but the 163 clips already live needed a one-time pass.
 *
 * The source clip is fetched from the local colour-rescued mirror when its
 * checksum matches the LIVE master (fast path, no download), otherwise
 * downloaded and checksum-verified before use, exactly the same two fences
 * `scripts/fix-media-cache-control.ts` uses and for the same reason: 35 of
 * that mirror's 326 objects turned out to differ from what is actually live.
 * The encode itself is verified (frame-count parity with the source, see the
 * lib) before anything is uploaded or written to the database.
 *
 * Idempotent: a row with `videoUrlSd` already set is skipped unless --force.
 * Re-running after an interruption only does what is left.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/generate-renditions.ts -- --dry-run
 *   npx tsx --env-file=.env.local scripts/generate-renditions.ts -- --limit 3
 *   npx tsx --env-file=.env.local scripts/generate-renditions.ts -- --from <mirror dir>
 *   npx tsx --env-file=.env.local scripts/generate-renditions.ts
 *
 * Flags:
 *   --from <dir>       Local mirror of <externalId>/snippet.mp4 folders (the
 *                       fast path). Downloads when absent or checksum-mismatched.
 *   --dry-run          Report what would be encoded; touch nothing.
 *   --limit N          Process at most N snippets.
 *   --external <id>    One snippet only.
 *   --force            Re-generate even when videoUrlSd is already set.
 */
import { PrismaClient } from "@prisma/client";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { uploadVideoSd } from "./lib/storage";
import { encodeSdRendition, hasFfmpeg } from "./lib/video-rendition";

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const DRY = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const FROM = arg("from");
const LIMIT = arg("limit") ? parseInt(arg("limit")!, 10) : Infinity;
const ONLY = arg("external");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const md5 = (buf: Buffer) => crypto.createHash("md5").update(buf).digest("hex");

/** S3-style multipart ETag: md5 of the concatenated raw part md5s, "-N". Same
 *  logic as fix-media-cache-control.ts; a handful of the larger clips were
 *  uploaded in multiple parts, so their ETag is not a plain content MD5. */
function multipartEtag(buf: Buffer, partSize: number): string {
  const parts = Math.ceil(buf.length / partSize);
  const digests: Buffer[] = [];
  for (let i = 0; i < parts; i++) {
    digests.push(crypto.createHash("md5").update(buf.subarray(i * partSize, (i + 1) * partSize)).digest());
  }
  return `${crypto.createHash("md5").update(Buffer.concat(digests)).digest("hex")}-${parts}`;
}
const isMultipartEtag = (etag: string | null) => !!etag && etag.includes("-");
function matchesEtag(buf: Buffer, etag: string | null): boolean {
  if (!etag) return false;
  if (!isMultipartEtag(etag)) return md5(buf) === etag;
  const n = parseInt(etag.split("-")[1], 10);
  const MB = 1024 * 1024;
  for (const partMB of [5, 6, 8, 10, 15, 16, 20, 25, 32, 50, 64, 100]) {
    const partSize = partMB * MB;
    if (Math.ceil(buf.length / partSize) !== n) continue;
    if (multipartEtag(buf, partSize) === etag) return true;
  }
  return false;
}

async function liveEtag(url: string): Promise<string | null> {
  const res = await fetch(url.split("?")[0], { headers: { Range: "bytes=0-0" } });
  return (res.headers.get("etag") ?? "").replace(/"/g, "") || null;
}

/** Bytes for the master clip: the mirror when it matches what is live, else a
 *  checksum-verified download. Never returns bytes that don't provably match
 *  the live object, since those bytes are what the whole batch's SSIM
 *  measurements (and the frame-count guarantee) were made against. */
async function sourceBytes(externalId: string, videoUrl: string): Promise<{ buf: Buffer; from: string } | string> {
  const etag = await liveEtag(videoUrl);
  if (FROM) {
    const local = path.join(FROM, externalId, "snippet.mp4");
    if (fs.existsSync(local)) {
      const buf = fs.readFileSync(local);
      if (matchesEtag(buf, etag)) return { buf, from: "mirror" };
    }
  }
  const res = await fetch(videoUrl.split("?")[0]);
  if (!res.ok) return `download failed: HTTP ${res.status}`;
  const buf = Buffer.from(await res.arrayBuffer());
  if (!matchesEtag(buf, etag) && !isMultipartEtag(etag)) {
    return `download checksum ${md5(buf)} != live etag ${etag}`;
  }
  return { buf, from: FROM ? "download (mirror differs)" : "download" };
}

async function main() {
  if (!hasFfmpeg()) {
    throw new Error("ffmpeg is not on PATH. This script needs it to build the SD rendition.");
  }
  if (FROM && !fs.existsSync(FROM)) throw new Error(`--from dir not found: ${FROM}`);

  const rows = await prisma.snippet.findMany({
    where: ONLY ? { externalId: ONLY } : undefined,
    select: { id: true, externalId: true, videoUrl: true, videoUrlSd: true },
    orderBy: { externalId: "asc" },
  });
  const todo = rows.filter((r) => FORCE || !r.videoUrlSd);
  console.log(
    `rows=${rows.length} needingRendition=${todo.length} dryRun=${DRY} limit=${LIMIT} force=${FORCE} ` +
      `mirror=${FROM ?? "(none, download only)"}\n`,
  );

  const counts = { done: 0, failed: 0, planned: 0 };
  const failures: string[] = [];
  let bytesIn = 0;
  let bytesOut = 0;
  const t0 = Date.now();

  for (const row of todo) {
    if (counts.done + counts.planned >= LIMIT) break;
    const label = row.externalId;

    const src = await sourceBytes(row.externalId, row.videoUrl);
    if (typeof src === "string") {
      console.log(`FAIL ${label}: ${src}`);
      counts.failed++;
      failures.push(label);
      continue;
    }

    if (DRY) {
      console.log(`PLAN ${label}: ${(src.buf.length / 1024).toFixed(0)}KB source via ${src.from}`);
      counts.planned++;
      continue;
    }

    const tmpIn = path.join(os.tmpdir(), `fs-src-${process.pid}-${Date.now()}.mp4`);
    fs.writeFileSync(tmpIn, src.buf);
    let uploaded: string | null = null;
    try {
      const enc = encodeSdRendition(tmpIn);
      if (!enc.ok) {
        console.log(`FAIL ${label}: ${enc.reason}`);
        counts.failed++;
        failures.push(label);
        continue;
      }
      uploaded = await uploadVideoSd(row.externalId, enc.buffer);
      const videoUrlSd = `${uploaded}?v=1`;
      await prisma.snippet.update({ where: { id: row.id }, data: { videoUrlSd } });
      bytesIn += src.buf.length;
      bytesOut += enc.bytes;
      counts.done++;
      console.log(
        `OK   ${label}: ${(src.buf.length / 1024).toFixed(0)}KB -> ${(enc.bytes / 1024).toFixed(0)}KB ` +
          `(${(src.buf.length / enc.bytes).toFixed(1)}x, ${enc.frames} frames) via ${src.from}`,
      );
    } catch (e) {
      console.log(`FAIL ${label}: ${String(e).slice(0, 200)}`);
      counts.failed++;
      failures.push(label);
    } finally {
      if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn);
    }
    await sleep(50);
  }

  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(
    `\n${DRY ? "planned" : "done"}=${DRY ? counts.planned : counts.done} failed=${counts.failed} ` +
      `${bytesIn ? `inMB=${(bytesIn / 1048576).toFixed(1)} outMB=${(bytesOut / 1048576).toFixed(1)} ` +
        `ratio=${(bytesIn / Math.max(bytesOut, 1)).toFixed(1)}x ` : ""}in ${secs}s`,
  );
  if (failures.length) {
    console.log(`FAILED:\n  ${failures.join("\n  ")}`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
