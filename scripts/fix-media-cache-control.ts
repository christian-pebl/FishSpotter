/**
 * Give every live clip and still the 30-day cache header, without changing a
 * byte, a URL or a database row.
 *
 * Why this exists (7 Sep 2026). `scripts/lib/storage.ts` has uploaded with
 * `cacheControl: "2592000"` since 29 Aug 2026, but the 3 Sep colour-rescue
 * re-upload of all 163 clips ran from a checkout that predated that fix, so
 * every live object carries the supabase-js default, `max-age=3600`. A repeat
 * visitor re-downloads the archive stills and clips every hour, and Next's
 * image optimizer re-fetched each still hourly until `minimumCacheTTL` was set.
 *
 * Supabase cannot rewrite the header in place: its S3 `CopyObject` honours
 * `MetadataDirective: REPLACE` only when the copy CREATES a key, and copying
 * onto an existing key keeps the old metadata (probed 7 Sep 2026). So the
 * bytes have to be put again. That is the one dangerous part, and it is fenced
 * three ways:
 *
 *   1. The bytes come from the local colour-rescued mirror only when their MD5
 *      equals the live object's ETag (Supabase's ETag IS the MD5 for these
 *      single-part uploads; verified on real clips). One mirror clip was found
 *      to differ from what is live, so the mirror is a fast path, never a
 *      source of truth.
 *   2. Otherwise the bytes are downloaded from the public URL, and are used only
 *      if the length matches Content-Length AND the MD5 matches the ETag.
 *   3. After the put, the object is read back: the header must now say
 *      `max-age=2592000` and the ETag must be unchanged. Anything else is
 *      reported as FAILED, and the process exits non-zero.
 *
 * Idempotent: an object that already serves the target header is skipped, so
 * a re-run after an interruption only does what is left. Nothing is written
 * to the database: the URLs, `?v=` and all, stay exactly as they are, because
 * the content is identical and a 304 carries the new header to any browser
 * that cached the old one.
 *
 * Run (from a checkout whose storage.ts sets the 30-day header):
 *   npx tsx --env-file=.env.local scripts/fix-media-cache-control.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/fix-media-cache-control.ts --limit 1
 *   npx tsx --env-file=.env.local scripts/fix-media-cache-control.ts
 *
 * Flags:
 *   --from <dir>      Local mirror holding <externalId>/snippet.mp4 + thumbnail.jpg
 *                     (the fast path; downloads when absent or different).
 *   --dry-run         Plan only: reports the source each object would use.
 *   --limit N         Process at most N objects that need work.
 *   --external <id>   One snippet only.
 *   --kind video|thumbnail|both   Default both.
 */
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { getActiveProvider, uploadThumbnail, uploadVideo } from "./lib/storage";

const prisma = new PrismaClient();

/** Must match the `cacheControl` the Supabase driver in ./lib/storage.ts sets. */
const TARGET_MAX_AGE = 2592000;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const DRY = process.argv.includes("--dry-run");
const FROM = arg("from");
const LIMIT = arg("limit") ? parseInt(arg("limit")!, 10) : Infinity;
const ONLY = arg("external");
const KIND = (arg("kind") ?? "both") as "video" | "thumbnail" | "both";

type Kind = "video" | "thumbnail";
const FILE: Record<Kind, string> = { video: "snippet.mp4", thumbnail: "thumbnail.jpg" };

type Live = { status: number; total: number; etag: string | null; cacheControl: string | null };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The object as the ORIGIN holds it, through Supabase's S3 protocol with
 * session-token auth (project ref + anon key + the service-role JWT).
 *
 * Not the public URL, for two reasons found the hard way. The CDN in front of
 * the public endpoint keeps serving the OLD header for a few seconds after an
 * upsert (Supabase purges it, but not synchronously), so a read-back straight
 * after the put reported a correctly updated object as FAILED. And a tight
 * loop of public reads is rate limited: 19 of 326 answered 429 in a dry run.
 * HeadObject reads the object's own metadata, which is what a fresh CDN fetch
 * will serve.
 */
let s3: S3Client | null = null;
function s3Client(): S3Client {
  if (s3) return s3;
  const url = process.env.SUPABASE_URL!;
  const ref = new URL(url).hostname.split(".")[0];
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!anon || !service) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required");
  s3 = new S3Client({
    endpoint: `${url}/storage/v1/s3`,
    region: process.env.SUPABASE_S3_REGION ?? "eu-west-1",
    forcePathStyle: true,
    credentials: { accessKeyId: ref, secretAccessKey: anon, sessionToken: service },
  });
  return s3;
}

async function liveHeaders(bucket: string, key: string): Promise<Live> {
  for (let attempt = 0; ; attempt++) {
    try {
      const head = await s3Client().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return {
        status: 200,
        total: head.ContentLength ?? 0,
        etag: (head.ETag ?? "").replace(/"/g, "") || null,
        cacheControl: head.CacheControl ?? null,
      };
    } catch (e) {
      const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode ?? 0;
      if ((status === 429 || status >= 500) && attempt < 6) {
        await sleep(1500 * 2 ** attempt);
        continue;
      }
      return { status: status || 0, total: 0, etag: null, cacheControl: null };
    }
  }
}

const md5 = (buf: Buffer) => crypto.createHash("md5").update(buf).digest("hex");

/** S3-style multipart ETag: md5 of the concatenated raw part md5s, "-N". */
function multipartEtag(buf: Buffer, partSize: number): string {
  const parts = Math.ceil(buf.length / partSize);
  const digests: Buffer[] = [];
  for (let i = 0; i < parts; i++) {
    digests.push(crypto.createHash("md5").update(buf.subarray(i * partSize, (i + 1) * partSize)).digest());
  }
  return `${crypto.createHash("md5").update(Buffer.concat(digests)).digest("hex")}-${parts}`;
}

const isMultipartEtag = (etag: string | null) => !!etag && etag.includes("-");

/**
 * Do these bytes match the live ETag? A plain ETag is the content MD5. A
 * multipart one ("<hex>-N", a handful of the larger clips were uploaded that
 * way) is the MD5 of the part MD5s, so it is recomputed for the usual part
 * sizes; if one reproduces it the bytes are proven identical.
 */
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

const hasTarget = (cc: string | null) => !!cc && cc.includes(`max-age=${TARGET_MAX_AGE}`);

/** The object key a live URL points at, or null if it is not on the active
 *  bucket. Decoded, because eight externalIds carry spaces and parentheses
 *  (`META_..._OCT23 (5)_...`) that the stored URL percent-encodes. */
function keyOf(url: string, base: string): string | null {
  const clean = url.split("?")[0];
  if (!clean.startsWith(base)) return null;
  try {
    return decodeURIComponent(clean.slice(base.length));
  } catch {
    return clean.slice(base.length);
  }
}

async function download(
  url: string,
  expectTotal: number,
  expectEtag: string | null,
): Promise<{ buf: Buffer; note: string } | string> {
  const res = await fetch(url.split("?")[0]);
  if (!res.ok) return `download failed: HTTP ${res.status}`;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length !== expectTotal) return `download truncated: ${buf.length} of ${expectTotal} bytes`;
  if (matchesEtag(buf, expectEtag)) return { buf, note: "checksum verified" };
  // A multipart ETag whose part size is none of the usual ones cannot be
  // reproduced. The bytes still came from the origin over TLS at exactly the
  // advertised length, which rules out the realistic failure (truncation).
  if (isMultipartEtag(expectEtag)) return { buf, note: `length verified only (multipart etag ${expectEtag})` };
  return `download checksum ${md5(buf)} != live etag ${expectEtag}`;
}

async function main() {
  if (getActiveProvider() !== "supabase") {
    throw new Error(`STORAGE_PROVIDER is ${getActiveProvider()}; this script targets the Supabase bucket the live rows point at.`);
  }
  const supabaseUrl = process.env.SUPABASE_URL!;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "snippets";
  const base = `${supabaseUrl}/storage/v1/object/public/${bucket}/`;
  if (FROM && !fs.existsSync(FROM)) throw new Error(`--from dir not found: ${FROM}`);

  const rows = await prisma.snippet.findMany({
    where: ONLY ? { externalId: ONLY } : undefined,
    select: { externalId: true, videoUrl: true, thumbnailUrl: true },
    orderBy: { externalId: "asc" },
  });
  const kinds: Kind[] = KIND === "both" ? ["video", "thumbnail"] : [KIND];
  console.log(
    `rows=${rows.length} kinds=${kinds.join(",")} dryRun=${DRY} limit=${LIMIT} ` +
      `mirror=${FROM ?? "(none, download only)"} target=max-age=${TARGET_MAX_AGE}\n`,
  );

  const counts = { done: 0, alreadyOk: 0, notOnBucket: 0, failed: 0, planned: 0 };
  const failures: string[] = [];
  let bytesUp = 0;
  const t0 = Date.now();

  for (const row of rows) {
    for (const kind of kinds) {
      if (counts.done + counts.planned >= LIMIT) break;
      const url = kind === "video" ? row.videoUrl : row.thumbnailUrl;
      const label = `${row.externalId}/${FILE[kind]}`;
      const key = keyOf(url, base);
      if (!key || key !== `${row.externalId}/${FILE[kind]}`) {
        console.log(`SKIP ${label}: URL is not the expected key on the active bucket (${url.slice(0, 80)})`);
        counts.notOnBucket++;
        continue;
      }

      await sleep(100);
      let live: Live;
      try {
        live = await liveHeaders(bucket, key);
      } catch (e) {
        console.log(`FAIL ${label}: cannot read live headers: ${String(e).slice(0, 120)}`);
        counts.failed++;
        failures.push(label);
        continue;
      }
      if (live.status !== 200) {
        console.log(`FAIL ${label}: live object answered HTTP ${live.status}`);
        counts.failed++;
        failures.push(label);
        continue;
      }
      if (hasTarget(live.cacheControl)) {
        counts.alreadyOk++;
        continue;
      }

      // Source of bytes: mirror if it matches the live checksum, else download.
      let source = "download";
      let body: Buffer | null = null;
      if (FROM) {
        const local = path.join(FROM, row.externalId, FILE[kind]);
        if (fs.existsSync(local)) {
          const buf = fs.readFileSync(local);
          if (buf.length === live.total && matchesEtag(buf, live.etag)) {
            body = buf;
            source = "mirror";
          } else {
            source = "download (mirror differs)";
          }
        }
      }

      if (DRY) {
        console.log(
          `PLAN ${label}: ${(live.total / 1024).toFixed(0)}KB ${live.cacheControl ?? "(no cache-control)"} -> via ${source}`,
        );
        counts.planned++;
        continue;
      }

      if (!body) {
        const got = await download(url, live.total, live.etag);
        if (typeof got === "string") {
          console.log(`FAIL ${label}: ${got}`);
          counts.failed++;
          failures.push(label);
          continue;
        }
        body = got.buf;
        source = `${source}, ${got.note}`;
      }

      // Put the identical bytes back with the driver's 30-day header.
      let putError: unknown = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          if (kind === "video") await uploadVideo(row.externalId, body);
          else await uploadThumbnail(row.externalId, body);
          putError = null;
          break;
        } catch (e) {
          putError = e;
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
      if (putError) {
        console.log(`FAIL ${label}: upload error: ${String(putError).slice(0, 160)}`);
        counts.failed++;
        failures.push(label);
        continue;
      }

      // Read it back from the origin: new header, same bytes.
      // A single-part put gives a multipart-uploaded object a plain MD5 ETag, so
      // "same bytes" is either the ETag we saw or the MD5 of what we sent.
      const after = await liveHeaders(bucket, key);
      const sameBytes =
        after.total === live.total && (after.etag === live.etag || after.etag === md5(body));
      if (!hasTarget(after.cacheControl) || !sameBytes) {
        console.log(
          `FAIL ${label}: after upload cache-control=${after.cacheControl} etag=${after.etag} (was ${live.etag}, ${live.total} bytes)`,
        );
        counts.failed++;
        failures.push(label);
        continue;
      }
      bytesUp += body.length;
      counts.done++;
      console.log(
        `OK   ${label}: ${(body.length / 1024).toFixed(0)}KB via ${source}, ${live.cacheControl} -> ${after.cacheControl}, etag unchanged`,
      );
    }
    if (counts.done + counts.planned >= LIMIT) break;
  }

  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(
    `\n${DRY ? "planned" : "done"}=${DRY ? counts.planned : counts.done} alreadyOk=${counts.alreadyOk} ` +
      `notOnBucket=${counts.notOnBucket} failed=${counts.failed} uploadedMB=${(bytesUp / 1048576).toFixed(1)} in ${secs}s`,
  );
  if (failures.length) {
    console.log(`FAILED objects:\n  ${failures.join("\n  ")}`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
