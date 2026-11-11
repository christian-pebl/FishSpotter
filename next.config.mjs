/** @type {import('next').NextConfig} */
const remotePatterns = [];

// Q3B-T1: defensive URL parse. CI has been failing for 10+ commits because
// one of the SUPABASE_URL secrets in GH Actions is truthy but not a valid
// URL, which made `new URL(...)` throw and crashed `next dev` before
// Playwright could even start. A try/catch keeps each host whitelist
// opt-in: if a URL is unparseable we just don't whitelist that host, and
// next/image falls back to its safe default of rejecting unknown remote
// hosts. No production behaviour change when the env vars are valid.
function whitelistHost(rawUrl) {
  if (!rawUrl) return;
  try {
    remotePatterns.push({
      protocol: "https",
      hostname: new URL(rawUrl).hostname,
    });
  } catch {
    // Intentionally swallow: a malformed URL in CI is recoverable
    // (image loads from that host will fail, but the app boots).
  }
}

// Snippet thumbnails are served by whichever storage provider is active
// (see scripts/lib/storage.ts). next/image only loads images from hosts
// listed here, so BOTH providers must be whitelisted: Supabase for legacy
// rows, and the Cloudflare R2 public host once STORAGE_PROVIDER=r2 has been
// migrated to. Missing the R2 host is what broke every /feed/browse
// thumbnail after the R2 migration.
whitelistHost(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL);
whitelistHost(process.env.R2_PUBLIC_URL);
// Literal fallback for the live R2 bucket's public host. R2_PUBLIC_URL is only
// consumed by the storage scripts, so it may be absent from the Next.js build
// env on Vercel even though all snippet rows point at this host. Hardcoding it
// guarantees thumbnails optimize regardless of build-time env. If R2_PUBLIC_URL
// IS set and resolves to the same host, the dedup below drops the duplicate.
whitelistHost("https://pub-b0fda9a751144df59165871565716de4.r2.dev");

// Dedup hosts so a present R2_PUBLIC_URL and the literal fallback don't both
// emit the same pattern.
const seenHosts = new Set();
const dedupedPatterns = remotePatterns.filter((p) => {
  if (seenHosts.has(p.hostname)) return false;
  seenHosts.add(p.hostname);
  return true;
});

const isProd = process.env.NODE_ENV === "production";

// Full source-listed CSP (2026-07-16 audit finding 3.2/5). Every host below
// was confirmed either by reading the DB directly (SpeciesImage/Snippet URLs
// -- Supabase, iNat, Wikimedia, Flickr, artsobservasjoner.no) or by reading
// the component that hits it (Leaflet -> tile.openstreetmap.org in
// MapModalInner.tsx). R2 is included even though no live row uses it today:
// next.config.mjs already whitelists it for next/image, and STORAGE_PROVIDER
// flips back to r2 for new uploads (see the Storage provider section of
// CLAUDE.md) -- omitting it would just break silently the next time that
// happens. No error-reporting host is listed: Sentry was removed on 11 Nov 2026
// (it never had a DSN). Add any future ingest host to connect-src.
const IMAGE_HOSTS = [
  "https://aazxphcrexkggbmmceli.supabase.co",
  "https://pub-b0fda9a751144df59165871565716de4.r2.dev",
  "https://inaturalist-open-data.s3.amazonaws.com",
  "https://upload.wikimedia.org",
  "https://live.staticflickr.com",
  "https://www.artsobservasjoner.no",
  "https://tile.openstreetmap.org",
];
const MEDIA_HOSTS = [
  "https://aazxphcrexkggbmmceli.supabase.co",
  "https://pub-b0fda9a751144df59165871565716de4.r2.dev",
];

// Dev mode needs 'unsafe-eval' (eval-based sourcemaps) and a websocket
// connect-src (HMR). Neither is needed -- or shipped -- in prod.
const CSP_DIRECTIVES = [
  `default-src 'self'`,
  // No nonce/hash infra exists for Next's inline bootstrap scripts or
  // Framer Motion's inline handlers, so 'unsafe-inline' is the pragmatic
  // floor here -- script injection is still blocked from any OTHER origin,
  // which is what actually matters (see audit 3.4: no XSS sink exists to
  // inject inline script into in the first place).
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  // Tailwind arbitrary values + the mask-image drift/pattern components
  // (DriftingSilhouettes, MarinePattern) render extensively via inline
  // `style={{}}`, which CSP governs through style-src.
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: ${IMAGE_HOSTS.join(" ")}`,
  `media-src 'self' ${MEDIA_HOSTS.join(" ")}`,
  `font-src 'self'`,
  `connect-src 'self'${isProd ? "" : " ws://localhost:*"}`,
  `base-uri 'self'`,
  `object-src 'none'`,
  `frame-ancestors 'none'`,
  `form-action 'self'`,
];

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  {
    key: "Content-Security-Policy",
    value: CSP_DIRECTIVES.join("; "),
  },
];

if (isProd) {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
}

const nextConfig = {
  poweredByHeader: false,
  // instrumentation.ts (fail-fast env validation) runs without a flag since
  // Next 15, so the old `experimental.instrumentationHook` is gone.
  images: {
    remotePatterns: dedupedPatterns,
    // Every image the optimizer serves is immutable per URL: snippet stills
    // carry a `?v=` that changes on re-cut, species WebPs are keyed by content
    // hash. The upstream objects only say `max-age=3600`, so without this the
    // optimizer re-fetched and re-encoded each still every hour it was viewed,
    // and the feed's posters (routed through it since 7 Sep 2026, see
    // src/lib/thumbnail-src.ts) would have multiplied that. 30 days, matching
    // the storage drivers' own cache header for new uploads.
    minimumCacheTTL: 2592000,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
