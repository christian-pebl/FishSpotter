/**
 * Resend client wrapper (S3-03). Reads RESEND_API_KEY at first use;
 * returns null when the env var isn't set so the rest of the app can
 * degrade gracefully (token rows still get written, sign-up still
 * succeeds, the user just doesn't receive an email until the operator
 * lands the API key in production env).
 */

import { Resend } from "resend";

let cached: Resend | null | undefined;

export function getResend(): Resend | null {
  if (cached !== undefined) return cached;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    cached = null;
    return null;
  }
  cached = new Resend(apiKey);
  return cached;
}
