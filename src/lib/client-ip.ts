/**
 * Best-effort client IP for rate-limit keying on unauthenticated routes.
 *
 * On Vercel the real client IP is the first entry of `x-forwarded-for`
 * (the platform appends its own hops after it). Falls back to
 * `x-real-ip`, then a constant so a missing header collapses all such
 * callers into one shared bucket rather than bypassing the limit.
 *
 * This trust assumption holds specifically because Vercel's edge network
 * is the only thing in front of this app today (2026-07-16 audit 3.2): if a
 * CDN or reverse proxy is ever added in front of it, or it moves off
 * Vercel, an attacker could set their own x-forwarded-for and bypass every
 * IP-keyed limit. Re-verify this assumption before any such infra change.
 */

type HeaderValue = string | string[] | null | undefined;

function firstIp(value: HeaderValue): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(",")[0]?.trim() || undefined;
}

export function clientIpKey(req: Request): string {
  return (
    firstIp(req.headers.get("x-forwarded-for")) ??
    firstIp(req.headers.get("x-real-ip")) ??
    "unknown"
  );
}

// NextAuth's `authorize(credentials, req)` callback hands back a
// RequestInternal whose `headers` is a plain object (string | string[]
// values), not a Web Headers instance, so it can't call req.headers.get()
// the way clientIpKey() above does. Same parsing + fallback logic, just
// fed from that shape instead.
export function clientIpKeyFromHeaders(
  headers: Record<string, HeaderValue> | undefined,
): string {
  return (
    firstIp(headers?.["x-forwarded-for"]) ??
    firstIp(headers?.["x-real-ip"]) ??
    "unknown"
  );
}
