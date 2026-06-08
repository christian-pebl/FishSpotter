/**
 * Route C: WebP transcode helpers for species reference photos.
 *
 * Species photos are cached from iNaturalist / Wikimedia as JPEG and served
 * today straight from those origins (a transatlantic hop, JPEG-only). This
 * module produces PEBL-hosted WebP derivatives at the two sizes the UI
 * actually renders, which are then uploaded via scripts/lib/storage.ts and
 * recorded on the SpeciesImage row. WebP is ~30-50% smaller than the source
 * JPEG, and serving from our own bucket puts the bytes on an edge near the
 * user instead of iNat's US S3.
 *
 * Kept deliberately pure (no DB, no network beyond an explicit fetch helper)
 * so the sharp pipeline is unit-testable against an in-memory fixture.
 */

import { createHash } from "node:crypto";
import sharp from "sharp";

/** The two rendered sizes. Max widths match the UI: 240px thumbs, 500px medium. */
export const WEBP_SIZES = {
  thumb: 240,
  medium: 500,
} as const;

export type WebpSize = keyof typeof WEBP_SIZES;

/** Default WebP quality. 80 is the visually-lossless sweet spot for photos. */
export const DEFAULT_WEBP_QUALITY = 80;

/**
 * Stable content key for a source photo. We hash the source URL (not the DB
 * row id) so re-transcoding the same photo overwrites the same object rather
 * than orphaning storage. Truncated to 32 hex chars — collision risk across a
 * few-hundred-row catalogue is negligible and the key stays short.
 */
export function sourceHash(sourceUrl: string): string {
  return createHash("sha1").update(sourceUrl).digest("hex").slice(0, 32);
}

export type TranscodeResult = {
  data: Buffer;
  width: number;
  height: number;
  bytes: number;
};

/**
 * Resize (never upscale) to `maxWidth` and encode as WebP. Honours EXIF
 * orientation first so portrait phone photos aren't served sideways. Returns
 * the encoded buffer plus its actual output dimensions.
 */
export async function transcodeToWebp(
  input: Buffer,
  maxWidth: number,
  quality: number = DEFAULT_WEBP_QUALITY,
): Promise<TranscodeResult> {
  const pipeline = sharp(input)
    .rotate() // apply EXIF orientation, then strip it
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality });

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, bytes: data.length };
}

/** Transcode both UI sizes from one source buffer. */
export async function transcodeAllSizes(
  input: Buffer,
  quality: number = DEFAULT_WEBP_QUALITY,
): Promise<Record<WebpSize, TranscodeResult>> {
  const [thumb, medium] = await Promise.all([
    transcodeToWebp(input, WEBP_SIZES.thumb, quality),
    transcodeToWebp(input, WEBP_SIZES.medium, quality),
  ]);
  return { thumb, medium };
}

/**
 * Download a source image to a Buffer. Bounded by `maxBytes` (default 25 MB)
 * so a hostile/misconfigured URL can't exhaust memory, and a timeout so a slow
 * origin can't stall the batch. Throws on non-2xx or oversize.
 */
export async function downloadImage(
  url: string,
  { maxBytes = 25 * 1024 * 1024, timeoutMs = 20_000 }: { maxBytes?: number; timeoutMs?: number } = {},
): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      // Wikimedia rejects requests without a descriptive UA; iNat is lenient
      // but we identify ourselves consistently across the image scripts.
      headers: { "User-Agent": "FishSpotter/1.0 (https://fish-spotter.vercel.app)" },
    });
    if (!res.ok) {
      throw new Error(`download failed: HTTP ${res.status} for ${url}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) {
      throw new Error(`download too large: ${buf.length} bytes for ${url}`);
    }
    return buf;
  } finally {
    clearTimeout(timer);
  }
}
