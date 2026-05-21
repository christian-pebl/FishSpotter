/**
 * Stable per-user unsubscribe-token derivation (S3-16, PECR Reg. 22).
 * Token = HMAC-SHA256(NEXTAUTH_SECRET, `digest:{userId}`). No DB rows
 * per email — links survive forever per user, which is fine because
 * the recipient owns their inbox.
 */

import { createHmac } from "node:crypto";

export function digestUnsubscribeToken(userId: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET missing");
  return createHmac("sha256", secret).update(`digest:${userId}`).digest("hex");
}

export function digestUnsubscribeUrl(userId: string, base?: string): string {
  const root = (base ?? process.env.NEXTAUTH_URL ?? "https://fish-spotter.vercel.app").replace(/\/$/, "");
  return `${root}/api/account/digest/unsubscribe?u=${userId}&t=${digestUnsubscribeToken(userId)}`;
}
