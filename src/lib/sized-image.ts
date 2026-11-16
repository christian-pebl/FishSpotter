/**
 * A small picture for a small slot.
 *
 * The landing page shows about twenty photos in tiles 105 to 170 CSS pixels
 * wide (the species strip and the six farm tiles) and used to fetch each one
 * at the size it was archived: farm heroes 1600 px wide and 150 to 290 KB,
 * Wikimedia thumbnails 960 px wide and 150 to 210 KB, iNaturalist `medium`
 * files up to 360 KB. Measured 12 Nov 2026 on production: 2.3 MB of images on
 * a 3.1 MB page, and Lighthouse put 1.9 MB of it down to sizing alone.
 *
 * Two routes, chosen per URL:
 *
 * 1. Pictures PEBL hosts (the storage bucket, and the files in `public/`) go
 *    through Next's image optimizer at a tile width, the same path the feed
 *    stills take (`thumbnail-src.ts`). That also makes the request first
 *    party: the storage host sits behind Cloudflare, which sets a cookie on
 *    every response, and this is a children's service.
 *
 * 2. Third-party originals (a species photo not yet copied to PEBL storage)
 *    are NOT sent through the optimizer. Whitelisting iNaturalist or Wikimedia
 *    there would let anyone serve any picture on those sites from
 *    fishspotter.app, and spend the free optimizer allowance doing it. A
 *    Wikimedia thumbnail is swapped for the 500 px size Wikimedia itself
 *    publishes, and loaded without credentials so its cookie is never stored.
 *    iNaturalist photos are left as they are: its next size down is 240 px,
 *    which is visibly soft in a card on a 2x phone. The lasting fix for both
 *    is `npm run db:backfill-webp`, which copies them to PEBL storage.
 *
 * Pure: the caller passes the hosts, so this renders the same on the server
 * and in a test.
 */
import { THUMBNAIL_QUALITY } from "./thumbnail-src";

/** Tile widths, both from Next's default `imageSizes` (the optimizer rejects others). */
export const TILE_WIDTHS = [256, 384] as const;

/** `sizes` for a tile about a third of a phone wide, capped on desktop. */
export const TILE_SIZES = "(min-width: 640px) 170px, 34vw";

/**
 * Local folders the optimizer may read. Must match `images.localPatterns` in
 * next.config.mjs; `sized-image.test.ts` checks the two against each other.
 */
export const LOCAL_IMAGE_FOLDERS = ["/farm-media/", "/hero/"] as const;

/** The literal R2 public host next.config.mjs whitelists as a fallback. */
const R2_DEV_HOST = "pub-b0fda9a751144df59165871565716de4.r2.dev";

type Env = Record<string, string | undefined>;

function hostOf(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

/**
 * Remote hosts the optimizer accepts. Mirrors the `whitelistHost` calls in
 * next.config.mjs, read from the same variables, so a URL this calls
 * optimizable is one the optimizer will serve.
 */
export function optimizerHosts(env: Env = process.env): string[] {
  const hosts = [
    hostOf(env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL),
    hostOf(env.R2_PUBLIC_URL),
    R2_DEV_HOST,
  ].filter((h): h is string => !!h);
  return [...new Set(hosts)];
}

function isLocalOptimizable(url: string): boolean {
  // No query string: the local pattern in next.config.mjs is an exact path.
  return LOCAL_IMAGE_FOLDERS.some((folder) => url.startsWith(folder)) && !url.includes("?");
}

export function canOptimize(url: string, hosts: readonly string[]): boolean {
  if (url.startsWith("/")) return isLocalOptimizable(url);
  const host = hostOf(url);
  return !!host && url.startsWith("https://") && hosts.includes(host);
}

export function optimizedSrc(
  url: string,
  width: number,
  quality: number = THUMBNAIL_QUALITY,
): string {
  return `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=${quality}`;
}

export function optimizedSrcSet(url: string, widths: readonly number[] = TILE_WIDTHS): string {
  return widths.map((w) => `${optimizedSrc(url, w)} ${w}w`).join(", ");
}

/**
 * Widest Wikimedia thumbnail a tile needs, and one of Wikimedia's standard
 * sizes. A card is 128 by 160 CSS px; a 3:2 photo at 500 px is 333 px tall,
 * which covers the card's 320 device pixels on a 2x phone without upscaling.
 * (330 px, the next size down, was tried and looked soft.)
 */
const WIKIMEDIA_TILE_PX = 500;

const WIKIMEDIA_THUMB =
  /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/[a-z]+\/thumb\/.+\/)(\d+)(px-[^/]+)$/;

/**
 * The smaller size of a third-party photo, when its host publishes one at a
 * predictable address. Anything unrecognised comes back unchanged.
 *
 * Wikimedia only: it only ever steps DOWN to 500 px, so a file that was
 * already smaller, or a thumbnail with a page or language prefix, is left
 * alone.
 */
export function smallerThirdParty(url: string): string {
  const wiki = WIKIMEDIA_THUMB.exec(url);
  if (wiki && Number(wiki[2]) > WIKIMEDIA_TILE_PX) return `${wiki[1]}${WIKIMEDIA_TILE_PX}${wiki[3]}`;
  return url;
}

export type SizedImage = {
  /** What the `<img>` loads first. */
  src: string;
  srcSet?: string;
  /** The untouched URL, used if `src` fails (optimizer down or over its allowance). */
  fallbackSrc: string;
  /** Set for hosts that send a cookie with every image and allow anonymous loads. */
  crossOrigin?: "anonymous";
};

export function sizedImage(url: string, hosts: readonly string[] = optimizerHosts()): SizedImage {
  if (canOptimize(url, hosts)) {
    return {
      src: optimizedSrc(url, TILE_WIDTHS[0]),
      srcSet: optimizedSrcSet(url),
      fallbackSrc: url,
    };
  }
  const src = smallerThirdParty(url);
  // upload.wikimedia.org sets a `WMF-Uniq` cookie on image responses and sends
  // `Access-Control-Allow-Origin: *`. An anonymous load gets the same picture
  // and the browser discards the cookie.
  const anonymous = hostOf(src) === "upload.wikimedia.org";
  return { src, fallbackSrc: url, ...(anonymous ? { crossOrigin: "anonymous" as const } : {}) };
}
