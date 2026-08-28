import { timingSafeEqual } from "crypto";

/**
 * Constant-time `Authorization: Bearer <secret>` check, shared by every
 * token-gated route that isn't behind a user session (/api/cron/*,
 * /api/metrics/summary). Returns false (never throws) when the secret is
 * unset, the header is missing, or the lengths differ — the length check
 * has to happen before the timing-safe compare because `timingSafeEqual`
 * throws on mismatched buffer lengths rather than returning false.
 */
export function isAuthorisedBearer(req: Request, expected: string | undefined): boolean {
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${expected}`);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Bearer check against CRON_SECRET, for the /api/cron/* routes. */
export function isAuthorisedCron(req: Request): boolean {
  return isAuthorisedBearer(req, process.env.CRON_SECRET);
}
