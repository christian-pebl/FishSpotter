/**
 * Best-effort client IP for rate-limit keying on unauthenticated routes.
 *
 * On Vercel the real client IP is the first entry of `x-forwarded-for`
 * (the platform appends its own hops after it). Falls back to
 * `x-real-ip`, then a constant so a missing header collapses all such
 * callers into one shared bucket rather than bypassing the limit.
 */
export function clientIpKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
