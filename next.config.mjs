import { withSentryConfig } from "@sentry/nextjs";

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
// happens. Sentry is NOT listed: SENTRY_DSN is unset (Sentry.init's own
// `enabled: Boolean(dsn)` guard makes it a no-op today), so there is no
// ingest host to allow yet -- add the project's *.ingest.<region>.sentry.io
// host to connect-src when a DSN is actually provisioned.
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

// Next 14 dev mode needs 'unsafe-eval' (webpack's eval-based sourcemaps) and
// a websocket connect-src (HMR). Neither is needed -- or shipped -- in prod.
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
  // Next 14.2.x gates the instrumentation.ts `register()` hook behind this
  // flag (it defaults to false and becomes the default only in Next 15).
  // Required so the fail-fast env validation in instrumentation.ts runs at
  // server boot. Build static-analysis is unaffected (the hook only fires on
  // the Node server runtime, see instrumentation.ts).
  experimental: {
    instrumentationHook: true,
  },
  images: {
    remotePatterns: dedupedPatterns,
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

// Wrap with the Sentry build plugin. This preserves every option in
// `nextConfig` above (image remotePatterns, security headers,
// experimental.instrumentationHook) and only layers Sentry's build-time
// behaviour on top. The plugin is deliberately configured NOT to require a
// Sentry account or token:
//   - silent: true            -> no plugin log spam in CI / local builds.
//   - SENTRY_AUTH_TOKEN unset  -> source-map upload is skipped automatically
//                                 (no token => no upload, no failure).
//   - disableLogger: true      -> tree-shakes Sentry logger statements.
//   - automaticVercelMonitors: false -> we manage crons via vercel.json.
// With SENTRY_DSN unset the runtime init files no-op, so the whole
// integration stays inert until a DSN is provided.
export default withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
  automaticVercelMonitors: false,
});
