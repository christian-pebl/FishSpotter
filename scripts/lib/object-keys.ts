/**
 * Where a clip's bytes live in storage: a name that says nothing about them.
 *
 * Until 12 Nov 2026 a clip was stored at `<externalId>/snippet.mp4`, and
 * `externalId` is the export folder name. For 56 of 139 live clips that name
 * carries a species label (`..._wrasse00007270_track_manual_...`), so the URL
 * a browser must be given to play a clip also told it what was in the clip.
 * The crowd's answer is the product here, and there is a real prize for 2,000
 * Pebbles.
 *
 * A clip object is now named after its own bytes:
 *
 *   clips/<hash>.mp4        the 1080p master
 *   clips/<hash>-sd.mp4     the 720p rendition (its OWN hash, not the master's)
 *   thumbs/<hash>.jpg       the still
 *
 * `<hash>` is the first 24 hex characters (96 bits) of the SHA-256 of the
 * file. Three things follow from naming by content:
 *
 *   - the name cannot leak anything, because nothing but the bytes goes in;
 *   - a re-cut or re-graded clip gets a new name by itself, so the `?v=N`
 *     cache-buster is gone and an object can be cached for a year;
 *   - the same key works on any provider, so moving the bucket later is a copy
 *     and a change of host, nothing else.
 *
 * `externalId` stays in the database as the key the sync matches folders on.
 * It is simply no longer part of any address.
 *
 * Pure: no SDK imports, so the tests need no credentials.
 */
import { createHash } from "node:crypto";

export type StorageKind = "video" | "thumbnail" | "video_sd";

/** Hex characters of SHA-256 kept in a key. 96 bits: far beyond any collision
 *  a few thousand clips could produce, short enough to read in a log. */
export const HASH_HEX_LENGTH = 24;

export function contentHash(body: Buffer): string {
  return createHash("sha256").update(body).digest("hex").slice(0, HASH_HEX_LENGTH);
}

/** The content-addressed key for a clip object. */
export function objectKey(kind: StorageKind, body: Buffer): string {
  const hash = contentHash(body);
  if (kind === "video") return `clips/${hash}.mp4`;
  if (kind === "video_sd") return `clips/${hash}-sd.mp4`;
  return `thumbs/${hash}.jpg`;
}

const CONTENT_KEY = new RegExp(
  `^(?:clips/[0-9a-f]{${HASH_HEX_LENGTH}}(?:-sd)?\\.mp4|thumbs/[0-9a-f]{${HASH_HEX_LENGTH}}\\.jpg)$`,
);

/** True for a key this module produced. */
export function isContentKey(key: string): boolean {
  return CONTENT_KEY.test(key);
}

/** True when `key` is the content key of the right shape for `kind`. */
export function isContentKeyFor(kind: StorageKind, key: string): boolean {
  if (!isContentKey(key)) return false;
  if (kind === "thumbnail") return key.startsWith("thumbs/");
  if (kind === "video_sd") return key.endsWith("-sd.mp4");
  return key.startsWith("clips/") && !key.endsWith("-sd.mp4");
}

const LEGACY_FILE: Record<StorageKind, string> = {
  video: "snippet.mp4",
  video_sd: "snippet_720.mp4",
  thumbnail: "thumbnail.jpg",
};

/**
 * The pre-rename key, `<externalId>/<file>`. Kept for two readers only: the
 * migration, which has to recognise and later delete these objects, and
 * `fix-media-cache-control.ts`, a finished one-off that rewrote them in place.
 * Nothing may upload a new clip under one of these.
 */
export function legacyObjectKey(externalId: string, kind: StorageKind): string {
  return `${externalId}/${LEGACY_FILE[kind]}`;
}

/**
 * The object key a public URL points at, or null when the URL is not under
 * `publicBase`. The query string (`?v=4`) is dropped and the path is decoded,
 * because eight export folder names carry spaces and parentheses.
 */
export function keyOfPublicUrl(url: string, publicBase: string): string | null {
  const base = publicBase.replace(/\/+$/, "") + "/";
  const clean = url.split("?")[0].split("#")[0];
  if (!clean.startsWith(base)) return null;
  const raw = clean.slice(base.length);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
