/**
 * Same-origin guard for state-changing requests (POST/PATCH/DELETE).
 *
 * Browsers always send `Origin` on cross-origin and most same-origin
 * state-changing requests, but a few user agents and direct (non-browser)
 * callers omit it. When `Origin` is absent we fall back to the `Referer`
 * header's origin. If NEITHER header is present on a state-changing request,
 * we reject (fail closed) rather than wave it through.
 */
export function assertSameOrigin(req: Request): boolean {
  const host = req.headers.get("host");
  if (!host) return false;

  const origin = req.headers.get("origin");
  if (origin) {
    return originHostMatches(origin, host);
  }

  // No Origin: fall back to comparing the Referer's origin against the host.
  const referer = req.headers.get("referer");
  if (referer) {
    return originHostMatches(referer, host);
  }

  // Neither Origin nor Referer on a state-changing request: reject.
  return false;
}

function originHostMatches(value: string, host: string): boolean {
  try {
    return new URL(value).host === host;
  } catch {
    return false;
  }
}
