/**
 * Storage provider abstraction for FishSpotter media (videos + thumbnails).
 *
 * Two providers are supported, selected by the STORAGE_PROVIDER env var:
 *
 *   supabase  (default)  — Supabase Storage. ~$0/mo storage on free tier
 *                          but charges egress past 5 GB/mo. Used today.
 *   r2                   — Cloudflare R2. Zero egress fees. 10 GB free
 *                          storage. The target for production at any scale.
 *
 * Switching providers is a deploy-time concern only; the Next.js runtime
 * never imports this module — it just reads Snippet.videoUrl as an opaque
 * URL. Provisioning + migration is documented in CLAUDE.md.
 *
 * Both providers expose the same three operations:
 *   uploadVideo(externalId, body, contentType) -> public URL
 *   uploadThumbnail(externalId, body, contentType) -> public URL
 *   buildPublicUrl(externalId, kind) -> deterministic URL (no upload)
 */

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type StorageProvider = "supabase" | "r2";

export type StorageKind = "video" | "thumbnail";

const VIDEO_FILENAME = "snippet.mp4";
const THUMBNAIL_FILENAME = "thumbnail.jpg";

function fileName(kind: StorageKind): string {
  return kind === "video" ? VIDEO_FILENAME : THUMBNAIL_FILENAME;
}

function objectKey(externalId: string, kind: StorageKind): string {
  return `${externalId}/${fileName(kind)}`;
}

export interface StorageDriver {
  provider: StorageProvider;
  upload(externalId: string, kind: StorageKind, body: Buffer, contentType: string): Promise<string>;
  buildPublicUrl(externalId: string, kind: StorageKind): string;
}

/* -------------------------------------------------------------------------- *
 * Supabase driver
 * -------------------------------------------------------------------------- */

function createSupabaseDriver(): StorageDriver {
  const url = process.env.SUPABASE_URL;
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

  return {
    provider: "supabase",
    async upload(externalId, kind, body, contentType) {
      const key = objectKey(externalId, kind);
      const { error } = await client.storage.from(bucket).upload(key, body, {
        upsert: true,
        contentType,
      });
      if (error) throw error;
      return this.buildPublicUrl(externalId, kind);
    },
    buildPublicUrl(externalId, kind) {
      return `${url}/storage/v1/object/public/${bucket}/${objectKey(externalId, kind)}`;
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

  const normalisedPublicUrl = publicUrl.replace(/\/$/, "");

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return {
    provider: "r2",
    async upload(externalId, kind, body, contentType) {
      const key = objectKey(externalId, kind);
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          // 30-day browser cache. Object content is immutable per externalId
          // (we never overwrite — re-encodes get a new externalId), so this
          // is safe.
          CacheControl: "public, max-age=2592000, immutable",
        }),
      );
      return this.buildPublicUrl(externalId, kind);
    },
    buildPublicUrl(externalId, kind) {
      return `${normalisedPublicUrl}/${objectKey(externalId, kind)}`;
    },
  };
}

/* -------------------------------------------------------------------------- *
 * Public API
 * -------------------------------------------------------------------------- */

/**
 * Reads STORAGE_PROVIDER from env. Falls back to "supabase" so existing
 * deployments (no env var) keep working with no behaviour change.
 */
export function getActiveProvider(): StorageProvider {
  const raw = (process.env.STORAGE_PROVIDER ?? "supabase").trim().toLowerCase();
  if (raw === "r2") return "r2";
  if (raw === "supabase") return "supabase";
  throw new Error(`Unknown STORAGE_PROVIDER "${raw}". Expected "r2" or "supabase".`);
}

let cachedDriver: StorageDriver | null = null;

export function getStorageDriver(): StorageDriver {
  if (cachedDriver) return cachedDriver;
  const provider = getActiveProvider();
  cachedDriver = provider === "r2" ? createR2Driver() : createSupabaseDriver();
  return cachedDriver;
}

export async function uploadVideo(
  externalId: string,
  body: Buffer,
  contentType = "video/mp4",
): Promise<string> {
  return getStorageDriver().upload(externalId, "video", body, contentType);
}

export async function uploadThumbnail(
  externalId: string,
  body: Buffer,
  contentType = "image/jpeg",
): Promise<string> {
  return getStorageDriver().upload(externalId, "thumbnail", body, contentType);
}

export function buildPublicUrl(externalId: string, kind: StorageKind): string {
  return getStorageDriver().buildPublicUrl(externalId, kind);
}
