/**
 * Thin Wikimedia Commons API client for fetching CC-licensed species photos.
 *
 * Used as a top-up source when iNat returns thin (Q3A-T5, 27 May 2026).
 * Some catalogue species have weak iNat coverage in specific lifeStage /
 * sex buckets, plaice larvae, catshark egg cases, etc. Wikimedia
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
  // Reject "no derivatives" first, cc-by-nd-4.0 also starts with cc-by-
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

// The Commons name search matches on file title + description text, so it
// happily returns historical engravings, museum plates, lithographs and
// non-web raster formats whose caption mentions the binomial (e.g. Haeckel
// and Iconographia Zoologica plates, or a `.tif` scan). Those are useless as
// "what you'd see underwater" reference photos, so drop them. NB this cannot
// catch a wrong-SUBJECT modern photo whose filename coincidentally contains
// the binomial (e.g. a person named "Aurelia Aurita"), only a human eye does
//, which is why teaching content (DiagnosticMark) is gated to curated photos.
const NON_PHOTO_EXTENSIONS = /\.(tif|tiff|svg|pdf|djvu|gif)$/i;
const NON_PHOTO_TITLE = /haeckel|iconographia|lithograph|engraving|\bplate\b|\bprint\b|drawing|illustration|woodcut|\b1[5-9]\d\d\b/i;

export function looksNonPhotographic(title: string | undefined, url: string | undefined): boolean {
  return NON_PHOTO_EXTENSIONS.test(url ?? "") || NON_PHOTO_TITLE.test(title ?? "");
}

/**
 * Binomials in a Commons file title. Underscores stand in for spaces there,
 * which is also why the epithet ends on `(?![a-z])` rather than a `\b`: `_` is
 * a word character, so `\b` never fires in `Pollachius_virens_shoal.jpg` and
 * the guard silently matched nothing on exactly the titles it was written for.
 */
const BINOMIAL = /\b([A-Z][a-z]{2,})[ _]([a-z]{3,})(?![a-z])/g;

/**
 * Words that follow a genus in a COMMON name rather than a binomial. Several
 * UK genera double as the English name of the animal (Conger, Sepia, Loligo),
 * so without this "Conger eel01.jpg" parses as the binomial "Conger eel" and
 * the conger's own photo gets refused from the conger's gallery.
 */
const COMMON_NAME_WORDS = new Set([
  "adult", "crab", "cuttlefish", "female", "fish", "goby", "jelly", "jellyfish",
  "juvenile", "larva", "male", "museum", "octopus", "prawn", "shell", "shrimp",
  "snail", "specimen", "squid", "starfish", "urchin", "worm", "wrasse",
]);

/** True when `a` and `b` differ by at most `max` single-character edits. */
function editDistanceAtMost(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length] <= max;
}

/**
 * True when the file's own title names a DIFFERENT species in the same genus.
 *
 * `gsrsearch` is a full-text search, so an exact-phrase query for
 * "Atherina presbyter" still matches a file whose DESCRIPTION mentions it,
 * and Commons duly returned `File:Atherina boyeri Sardinia.jpg`, the
 * big-scale sand smelt, for the sand smelt. Congeners are the one case a
 * vision check cannot save us from: the two fish are near-identical, and the
 * model is asked "is this a good photo of X?", a leading question it answers
 * yes to. The file's own title is the identity claim, the same test the
 * species-reference work settled on for MarLIN and FishBase pages.
 *
 * Deliberately narrow: only a same-genus, different-epithet title is refused.
 * A title with no binomial in it, or one naming an unrelated genus, is left
 * alone, because titles like "Sand smelt shoal" would otherwise parse as a
 * binomial and every honest file would be thrown away with the bad one.
 */
export function titleNamesACongener(title: string | undefined, scientificName: string): boolean {
  if (!title) return false;
  const [genus, epithet] = scientificName.trim().split(/\s+/);
  if (!genus || !epithet) return false;

  const cleaned = title.replace(/^File:/i, "").replace(/_/g, " ");
  const flat = cleaned.toLowerCase();

  // If the file names the species we asked for anywhere in its title, it is
  // ours whatever else the title mentions. Commons captions the subject in the
  // local language first, so "Sepia comun (Sepia officinalis), Arrabida" reads
  // as a Spanish common name followed by the real binomial.
  if (flat.includes(`${genus.toLowerCase()} ${epithet.toLowerCase()}`)) return false;

  for (const m of cleaned.matchAll(BINOMIAL)) {
    if (m[1].toLowerCase() !== genus.toLowerCase()) continue;
    const other = m[2].toLowerCase();
    // A genus followed by a short or common English word is a common name, not
    // a binomial: "Conger eel01.jpg" is a conger eel, and refusing it would
    // throw away the honest file along with the impostor.
    if (other.length < 4 || COMMON_NAME_WORDS.has(other)) continue;
    // One character apart is an orthographic variant of the same epithet, not
    // a different animal: Commons files the veined squid under both
    // "Loligo forbesi" and "Loligo forbesii".
    if (editDistanceAtMost(other, epithet.toLowerCase(), 1)) continue;
    return true;
  }
  return false;
}

/** Width Commons is asked to render the display copy at. */
export const COMMONS_RENDER_WIDTH = 1280;
/** Width the small strip thumbnail is derived at. */
const THUMB_STRIP_WIDTH = 480;

/** Drop the `?utm_source=...` analytics tail the Commons API appends. */
function stripQuery(url: string): string {
  const q = url.indexOf("?");
  return q === -1 ? url : url.slice(0, q);
}

/** The rendered copy when Commons produced one, else the original. */
function scaledOr(thumbUrl: string | undefined, originalUrl: string): string {
  return stripQuery(thumbUrl ?? originalUrl);
}

/**
 * A NARROWER render of a thumb URL Commons has already proved it can produce.
 *
 * Commons thumb paths carry their width in the last segment
 * (`.../thumb/0/00/File.jpg/1280px-File.jpg`), and a smaller render of a file
 * that renders at 1280 always exists, so rewriting downwards is safe in a way
 * that rewriting upwards is not. Returns null if the URL is not a thumb path,
 * so the caller falls back rather than inventing one.
 */
function narrowerThumb(thumbUrl: string | undefined, width: number): string | null {
  if (!thumbUrl) return null;
  const clean = stripQuery(thumbUrl);
  const m = /\/(\d+)px-([^/]+)$/.exec(clean);
  if (!m) return null;
  if (Number(m[1]) <= width) return clean;
  return clean.replace(/\/\d+px-([^/]+)$/, `/${width}px-$1`);
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
  const thumbWidth = args.thumbWidth ?? COMMONS_RENDER_WIDTH;

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
    if (looksNonPhotographic(page.title, info.url)) continue;
    if (titleNamesACongener(page.title, args.scientificName)) continue;
    const licenseSlug = info.extmetadata?.License?.value;
    const usageTerms = info.extmetadata?.UsageTerms?.value;
    if (!isAcceptedLicense(licenseSlug, usageTerms)) continue;
    photos.push({
      // The DISPLAY url is Commons' own scaled render, never the archive
      // original. Originals here average about 2MB and one conger photo is
      // 14.3MB at 6000x4000; the gallery paints them into a grid tile a few
      // hundred pixels wide, so the browser downloads a hundred times what it
      // draws. The same file at 1280px is 117KB. Use the API's `thumburl`
      // rather than building the /thumb/ path by hand: Commons refuses to
      // render a thumb at or above the original's own width and answers 404
      // or 400, so a constructed URL is a broken image on exactly the small
      // files where it saves nothing.
      url: scaledOr(info.thumburl, info.url),
      thumbUrl: narrowerThumb(info.thumburl, THUMB_STRIP_WIDTH) ?? scaledOr(info.thumburl, info.url),
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
