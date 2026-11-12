/**
 * Does a buffer match a storage ETag?
 *
 * For a single-part upload, Supabase Storage and R2 (both S3-compatible) set
 * the ETag to the MD5 of the bytes. For a multipart upload the ETag is the MD5
 * of the concatenated part MD5s, followed by `-<parts>`: still a function of
 * the bytes, but only once the part size is known, so the usual sizes are
 * tried. 28 of the 139 live masters carry a multipart ETag (measured 12 Nov
 * 2026).
 *
 * Same logic `generate-renditions.ts` and `fix-media-cache-control.ts` each
 * carry privately; new code should use this copy.
 */
import { createHash } from "node:crypto";

const MB = 1024 * 1024;
const PART_SIZES_MB = [5, 6, 8, 10, 15, 16, 20, 25, 32, 50, 64, 100];

export const md5Hex = (buf: Buffer): string => createHash("md5").update(buf).digest("hex");

export const isMultipartEtag = (etag: string | null | undefined): boolean =>
  !!etag && /-\d+$/.test(etag);

export function multipartEtag(buf: Buffer, partSize: number): string {
  const parts = Math.ceil(buf.length / partSize);
  const digests: Buffer[] = [];
  for (let i = 0; i < parts; i++) {
    digests.push(createHash("md5").update(buf.subarray(i * partSize, (i + 1) * partSize)).digest());
  }
  return `${createHash("md5").update(Buffer.concat(digests)).digest("hex")}-${parts}`;
}

export type EtagVerdict = "md5" | "multipart" | "no-match" | "no-etag";

/** How (or whether) `buf` is proven to be the object behind `etag`. */
export function checkEtag(buf: Buffer, etag: string | null | undefined): EtagVerdict {
  const clean = (etag ?? "").replace(/"/g, "").replace(/^W\//, "");
  if (!clean) return "no-etag";
  if (!isMultipartEtag(clean)) return md5Hex(buf) === clean ? "md5" : "no-match";
  const parts = parseInt(clean.split("-").pop()!, 10);
  for (const mb of PART_SIZES_MB) {
    const partSize = mb * MB;
    if (Math.ceil(buf.length / partSize) !== parts) continue;
    if (multipartEtag(buf, partSize) === clean) return "multipart";
  }
  return "no-match";
}
