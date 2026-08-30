/**
 * Where this site publicly lives.
 *
 * There is exactly one answer, and this is it. Before this module, fifteen call
 * sites each answered it themselves and every one of them said
 * `fish-spotter.vercel.app`: robots.txt, the sitemap, `metadataBase` (so every
 * share card), and the links in every transactional email we send. The real
 * domain appeared nowhere in the codebase at all.
 *
 * The visible cost was that `www.fishspotter.app` served a robots.txt naming
 * the Vercel host as its sitemap, and a sitemap claiming every page lived
 * there. The live domain was pointing search engines away from itself.
 *
 * Note what this is NOT read from: `NEXTAUTH_URL`, which thirteen of those call
 * sites used. That variable answers a different question (which origin NextAuth
 * signs callbacks for), and it is not set on Vercel at all, so every caller was
 * silently landing on its own hardcoded fallback. Auth is unaffected by this
 * change: NextAuth derives its URLs from the request host, which is why
 * /api/auth/providers already reports each host as itself.
 *
 * The default is the `www` host deliberately. The apex 308-redirects to it, and
 * a canonical URL that points at a redirect is a canonical nobody can trust. If
 * the bare domain is ever preferred, flip the redirect in Vercel FIRST, then
 * change this constant, in that order.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.fishspotter.app"
).replace(/\/$/, "");
