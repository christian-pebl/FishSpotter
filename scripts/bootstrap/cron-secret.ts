/**
 * CRON_SECRET generator.
 *
 * 32 random bytes (256 bits) hex-encoded → 64-char string. Used by
 * /api/cron/* routes' Bearer-token check. The orchestrator calls
 * this once when CRON_SECRET isn't already in tokens.json or in
 * Vercel env.
 */

import { randomBytes } from "node:crypto";

export function generateCronSecret(): string {
  return randomBytes(32).toString("hex");
}
