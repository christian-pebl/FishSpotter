/** @type {import('next').NextConfig} */
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const remotePatterns = [];

// Q3B-T1: defensive URL parse. CI has been failing for 10+ commits because
// one of the SUPABASE_URL secrets in GH Actions is truthy but not a valid
// URL, which made `new URL(...)` throw and crashed `next dev` before
// Playwright could even start. A try/catch keeps the host whitelist
// opt-in: if the URL is unparseable we just don't whitelist anything, and
// next/image falls back to its safe default of rejecting unknown remote
// hosts. No production behaviour change when SUPABASE_URL is valid.
if (supabaseUrl) {
  try {
    const hostname = new URL(supabaseUrl).hostname;
    remotePatterns.push({
      protocol: "https",
      hostname,
    });
  } catch {
    // Intentionally swallow: a malformed SUPABASE_URL in CI is recoverable
    // (image loads will fail for that host, but the app boots).
  }
}

const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

if (isProd) {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
}

const nextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns,
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
