/**
 * Crypto helpers shared by the password-reset (S3-04) and email-
 * verification (S3-06) flows. Tokens are stored as SHA-256 hashes at
 * rest so a DB leak doesn't hand over active reset / verify links.
 * The plain token only ever lives in the outbound email body.
 */

import { randomBytes, createHash } from "node:crypto";

/** Generate a 32-byte random token, returned as 64-char hex. */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/** SHA-256 of the plain token. Stable across processes — no salt
 *  because the entropy in the source is already 256 bits. */
export function hashToken(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h
export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h
