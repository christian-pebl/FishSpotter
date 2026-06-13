import { timingSafeEqual } from "crypto";

/**
 * Shared bearer-token check for the /api/cron/* routes.
 *
 * Compares the request's Authorization header against `Bearer ${CRON_SECRET}`
 * using a constant-time compare, so the secret can't be brute-forced by
 * measuring response latency. Returns false (never throws) when the secret is
 * unset, the header is missing, or the lengths differ.
 */
export function isAuthorisedCron(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
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
