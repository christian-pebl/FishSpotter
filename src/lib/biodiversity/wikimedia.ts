/**
 * Thin Wikimedia Commons API client for fetching CC-licensed species photos.
 *
 * Used as a top-up source when iNat returns thin (Q3A-T5, 27 May 2026).
 * Some catalogue species have weak iNat coverage in specific lifeStage /
 * sex buckets — plaice larvae, catshark egg cases, etc. Wikimedia
 * Commons often has better coverage for those edge cases because it
 * pools from museum collections + textbook illustrations.
 *
 * Docs: https://commons.wikimedia.org/w/api.php
 *
 * No auth required. Rate limit is per-IP and generous; we still go
 * through the shared retry helper so a transient 429 doesn't kill the
 * cron run.
 */

import { isRetryableStatus, nextRetryDelay } from "./inaturalist";

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

// Accept the same CC licenses as the iNat path. The Wikimedia
// extmetadata exposes a normalised slug in `License.value`; we match
// against the prefix (cc-by-4.0, cc-by-sa-3.0, etc. all start with
// their family slug). Excluding cc-by-nd because we may want to crop
// the photo for the candidate-picker thumbnail.
const ACCEPTED_LICENSE_PREFIXES = ["cc0", "cc-by-", "cc-by-sa-", "cc-by-nc-"] as const;
const PUBLIC_DOMAIN_MARKERS = ["public domain", "pd-"] as const;

const MAX_RETRIES = 3;

export type WikimediaPhoto = {
  url: string;
  thumbUrl: string;
  title: string;
  attribution: string;
  license: string;
  sourceUrl: string;
  width: number | null;
  height: number | null;
};

type CommonsImageInfo = {
  url: string;
  thumburl?: string;
  width?: number;
  height?: number;
  descriptionurl: string;
  extmetadata?: {
    Artist?: { value?: string };
    Credit?: { value?: string };
    LicenseShortName?: { value?: string };
    License?: { value?: string };
    UsageTerms?: { value?: string };
  };
};

type CommonsSearchResponse = {
  query?: {
    pages?: Record<
      string,
      {
        title: string;
        imageinfo?: CommonsImageInfo[];
      }
    >;
  };
};

async function fetchWithRetry(url: string): Promise<Response> {
  let attempt = 0;
  while (true) {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "FishSpotter/1.0 (https://fish-spotter.vercel.app)",
      },
    });
    if (res.ok) return res;
    if (!isRetryableStatus(res.status)) return res;
    if (attempt >= MAX_RETRIES - 1) return res;
    const delay = nextRetryDelay(attempt, res.headers.get("Retry-After"));
    await new Promise((resolve) => setTimeout(resolve, delay));
    attempt++;
  }
}

function stripHtml(html: string | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

export function isAcceptedLicense(licenseSlug: string | undefined, usageTerms: string | undefined): boolean {
  const slug = (licenseSlug ?? "").toLowerCase().trim();
  if (slug === "cc0" || slug === "cc-zero") return true;
  // Reject "no derivatives" first — cc-by-nd-4.0 also starts with cc-by-
  // and would slip through the family prefix check below otherwise.
  // Wikimedia includes ND in the slug as either "-nd-" (versioned) or
  // "-nd" (suffix without version).
  if (/-nd(-|$)/.test(slug)) return false;
  if (ACCEPTED_LICENSE_PREFIXES.some((p) => slug.startsWith(p))) return true;
  // Some PD-tagged files don't carry a `License` slug; fall back to the
  // human-readable usage terms.
  const terms = (usageTerms ?? "").toLowerCase();
  if (PUBLIC_DOMAIN_MARKERS.some((m) => terms.includes(m))) return true;
  return false;
}

function normaliseLicense(licenseSlug: string | undefined): string {
  const slug = (licenseSlug ?? "").toLowerCase().trim();
  if (slug.startsWith("cc-by-nc-")) return "cc-by-nc";
  if (slug.startsWith("cc-by-sa-")) return "cc-by-sa";
  if (slug.startsWith("cc-by-")) return "cc-by";
  if (slug === "cc0" || slug === "cc-zero") return "cc0";
  return slug || "unknown";
}

function buildAttribution(info: CommonsImageInfo): string {
  const artist = stripHtml(info.extmetadata?.Artist?.value);
  const credit = stripHtml(info.extmetadata?.Credit?.value);
  const license = stripHtml(info.extmetadata?.LicenseShortName?.value) || "Wikimedia Commons";
  const author = artist || credit || "Wikimedia Commons";
  return `${author}, ${license} via Wikimedia Commons`;
}

export async function fetchPhotosFromWikimedia(args: {
  scientificName: string;
  limit?: number;
  thumbWidth?: number;
}): Promise<WikimediaPhoto[]> {
  const limit = args.limit ?? 6;
  const thumbWidth = args.thumbWidth ?? 600;

  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    // Exact-phrase the scientific name so we don't pull Anglerfish-named
    // files when searching for "Pollachius pollachius".
    gsrsearch: `"${args.scientificName}"`,
    gsrnamespace: "6", // File:
    gsrlimit: String(Math.min(limit * 2, 20)), // overshoot so the licence filter can prune
    prop: "imageinfo",
    iiprop: "url|extmetadata|size",
    iiurlwidth: String(thumbWidth),
    // Lift CORS for browser-side callers (we call from Node so it doesn't
    // matter, but it costs nothing and keeps the URL pasteable for debug).
    origin: "*",
  });
  const url = `${COMMONS_API}?${params.toString()}`;

  const res = await fetchWithRetry(url);
  if (!res.ok) {
    throw new Error(`Wikimedia ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as CommonsSearchResponse;
  const pages = Object.values(json.query?.pages ?? {});

  const photos: WikimediaPhoto[] = [];
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info?.url) continue;
    const licenseSlug = info.extmetadata?.License?.value;
    const usageTerms = info.extmetadata?.UsageTerms?.value;
    if (!isAcceptedLicense(licenseSlug, usageTerms)) continue;
    photos.push({
      url: info.url,
      thumbUrl: info.thumburl ?? info.url,
      title: page.title,
      attribution: buildAttribution(info),
      license: normaliseLicense(licenseSlug),
      sourceUrl: info.descriptionurl,
      width: info.width ?? null,
      height: info.height ?? null,
    });
    if (photos.length >= limit) break;
  }
  return photos;
}
