/**
 * Storage provider abstraction for FishSpotter media (videos + thumbnails).
 *
 * Two providers are supported, selected by the STORAGE_PROVIDER env var:
 *
 *   supabase  (default) , Supabase Storage. ~$0/mo storage on free tier
 *                          but charges egress past 5 GB/mo. Used today.
 *   r2                  , Cloudflare R2. Zero egress fees. 10 GB free
 *                          storage. The target for production at any scale.
 *
 * Switching providers is a deploy-time concern only; the Next.js runtime
 * never imports this module, it just reads Snippet.videoUrl as an opaque
 * URL. Provisioning + migration is documented in CLAUDE.md.
 *
 * A clip object is stored under a key made from its own bytes
 * (`clips/<hash>.mp4`, see ./object-keys.ts), never from the export folder
 * name, so the address of a clip says nothing about what is in it. That is why
 * the upload functions take no `externalId`: there is nothing for it to do.
 * The caller writes the URL that comes back into the row.
 *
 *   uploadVideo(body)      -> public URL of clips/<hash>.mp4
 *   uploadVideoSd(body)    -> public URL of clips/<hash>-sd.mp4
 *   uploadThumbnail(body)  -> public URL of thumbs/<hash>.jpg
 *   publicUrlFor(kind, body) -> the same URL, without uploading
 */

import { DeleteObjectsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { objectKey, type StorageKind } from "./object-keys";

export type { StorageKind } from "./object-keys";

export type StorageProvider = "supabase" | "r2";

export interface UploadOptions {
  /**
   * The key is derived from the bytes, so the object can never change under
   * it. Cached for a year instead of 30 days. Only for content-addressed keys.
   */
  immutable?: boolean;
}

/** Seconds. Content-addressed objects: the name changes when the bytes do. */
const IMMUTABLE_MAX_AGE = 31536000;
/** Seconds. Everything else (species WebPs are keyed by source URL, not bytes). */
const DEFAULT_MAX_AGE = 2592000;

export interface StorageDriver {
  provider: StorageProvider;
  /** Everything before the object key in a public URL, no trailing slash. */
  publicBase: string;
  /** Upload a clip object under its content-addressed key. Returns the public URL. */
  upload(kind: StorageKind, body: Buffer, contentType: string): Promise<string>;
  // Lower-level put at an arbitrary key (species-image WebP derivatives, and
  // the clip migration, which computes the key itself). Returns the public URL.
  uploadObject(key: string, body: Buffer, contentType: string, options?: UploadOptions): Promise<string>;
  publicUrlForKey(key: string): string;
  /** Delete objects by key. Only the clip migration's clean-up step calls this. */
  removeObjects(keys: string[]): Promise<void>;
}

/** Each path segment encoded, slashes kept: eight legacy keys hold spaces. */
function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

/** The public URL of `key` under a provider's public base. */
export function publicUrlUnder(publicBase: string, key: string): string {
  return `${publicBase.replace(/\/+$/, "")}/${encodeKey(key)}`;
}

/**
 * A provider's public base URL, from the NON-SECRET variables alone. A dry run
 * of the clip migration uses this instead of a driver, so it can be run with
 * no storage credentials in the environment at all: it cannot upload or
 * delete, because it never holds a key.
 */
export function publicBaseFor(provider: StorageProvider): string {
  if (provider === "r2") {
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (!publicUrl) throw new Error("R2_PUBLIC_URL is not set.");
    return publicUrl.replace(/\/+$/, "");
  }
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  if (!url) throw new Error("SUPABASE_URL is not set.");
  return `${url}/storage/v1/object/public/${process.env.SUPABASE_STORAGE_BUCKET ?? "snippets"}`;
}

/* -------------------------------------------------------------------------- *
 * Supabase driver
 * -------------------------------------------------------------------------- */

function createSupabaseDriver(): StorageDriver {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "snippets";

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase storage provider selected, but SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.",
    );
  }

  const client: SupabaseClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const publicBase = publicBaseFor("supabase");

  return {
    provider: "supabase",
    publicBase,
    async upload(kind, body, contentType) {
      return this.uploadObject(objectKey(kind, body), body, contentType, { immutable: true });
    },
    async uploadObject(key, body, contentType, options) {
      const { error } = await client.storage.from(bucket).upload(key, body, {
        upsert: true,
        contentType,
        // Without this Supabase serves `Cache-Control: no-cache`, so every
        // repeat visitor re-downloads every clip and thumbnail and the CDN in
        // front of it never stores them (measured 29 Aug 2026). 30 days for a
        // key that could in principle be overwritten; a year for a
        // content-addressed one, which cannot. (Supabase takes seconds only,
        // so there is no `immutable` token here; R2 below sends one.)
        cacheControl: String(options?.immutable ? IMMUTABLE_MAX_AGE : DEFAULT_MAX_AGE),
      });
      if (error) throw error;
      return this.publicUrlForKey(key);
    },
    publicUrlForKey(key) {
      return publicUrlUnder(publicBase, key);
    },
    async removeObjects(keys) {
      // The API takes up to 1000 paths a call; stay well under.
      for (let i = 0; i < keys.length; i += 100) {
        const { error } = await client.storage.from(bucket).remove(keys.slice(i, i + 100));
        if (error) throw error;
      }
    },
  };
}

/* -------------------------------------------------------------------------- *
 * Cloudflare R2 driver (S3-compatible)
 * -------------------------------------------------------------------------- */

function createR2Driver(): StorageDriver {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
    throw new Error(
      "R2 storage provider selected, but one or more of R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, " +
        "R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL is missing. See CLAUDE.md " +
        '"Cloudflare R2 setup" for the full env-var list.',
    );
  }

  const publicBase = publicBaseFor("r2");

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return {
    provider: "r2",
    publicBase,
    async upload(kind, body, contentType) {
      return this.uploadObject(objectKey(kind, body), body, contentType, { immutable: true });
    },
    async uploadObject(key, body, contentType, options) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: options?.immutable
            ? `public, max-age=${IMMUTABLE_MAX_AGE}, immutable`
            : `public, max-age=${DEFAULT_MAX_AGE}, immutable`,
        }),
      );
      return this.publicUrlForKey(key);
    },
    publicUrlForKey(key) {
      return publicUrlUnder(publicBase, key);
    },
    async removeObjects(keys) {
      for (let i = 0; i < keys.length; i += 100) {
        await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: keys.slice(i, i + 100).map((Key) => ({ Key })) },
          }),
        );
      }
    },
  };
}

/* -------------------------------------------------------------------------- *
 * Public API
 * -------------------------------------------------------------------------- */

function parseProvider(raw: string): StorageProvider {
  const value = raw.trim().toLowerCase();
  if (value === "r2") return "r2";
  if (value === "supabase") return "supabase";
  throw new Error(`Unknown STORAGE_PROVIDER "${value}". Expected "r2" or "supabase".`);
}

/**
 * Reads STORAGE_PROVIDER from env. Falls back to "supabase" so existing
 * deployments (no env var) keep working with no behaviour change.
 */
export function getActiveProvider(): StorageProvider {
  return parseProvider(process.env.STORAGE_PROVIDER ?? "supabase");
}

const cachedDrivers = new Map<StorageProvider, StorageDriver>();

/** A driver for a named provider, whatever STORAGE_PROVIDER says. The clip
 *  migration needs this to reach the bucket a clip is leaving. */
export function getStorageDriverFor(provider: StorageProvider): StorageDriver {
  let driver = cachedDrivers.get(provider);
  if (!driver) {
    driver = provider === "r2" ? createR2Driver() : createSupabaseDriver();
    cachedDrivers.set(provider, driver);
  }
  return driver;
}

export function getStorageDriver(): StorageDriver {
  return getStorageDriverFor(getActiveProvider());
}

export async function uploadVideo(body: Buffer, contentType = "video/mp4"): Promise<string> {
  return getStorageDriver().upload("video", body, contentType);
}

export async function uploadThumbnail(body: Buffer, contentType = "image/jpeg"): Promise<string> {
  return getStorageDriver().upload("thumbnail", body, contentType);
}

/** The 720p rendition (see scripts/lib/video-rendition.ts). */
export async function uploadVideoSd(body: Buffer, contentType = "video/mp4"): Promise<string> {
  return getStorageDriver().upload("video_sd", body, contentType);
}

/** The URL `body` would be served from, without uploading it. */
export function publicUrlFor(kind: StorageKind, body: Buffer): string {
  return getStorageDriver().publicUrlForKey(objectKey(kind, body));
}

/* -------------------------------------------------------------------------- *
 * Species-image WebP derivatives (Route C)
 * -------------------------------------------------------------------------- */

export type SpeciesImageSize = "thumb" | "medium";

/**
 * Object key for a species-image WebP derivative. Keyed by a stable content
 * hash of the source URL (passed in by the caller) rather than the DB row id,
 * so re-transcoding the same source photo overwrites the same object instead
 * of orphaning the old one. Lives under a `species/` prefix to keep it cleanly
 * separable from the snippet objects in the same bucket.
 */
export function speciesImageKey(hash: string, size: SpeciesImageSize): string {
  return `species/${hash}/${size}.webp`;
}

/** Upload one WebP derivative and return its public URL. */
export async function uploadSpeciesImage(
  hash: string,
  size: SpeciesImageSize,
  body: Buffer,
): Promise<string> {
  return getStorageDriver().uploadObject(
    speciesImageKey(hash, size),
    body,
    "image/webp",
  );
}
