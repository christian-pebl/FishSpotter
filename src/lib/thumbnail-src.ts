/**
 * The clip still, sized for a screen instead of for an archive.
 *
 * Every snippet thumbnail in storage is the full 1920x1080 JPEG the exporter
 * wrote, 170 to 560 KB each, and the feed paints it into a phone-sized card
 * three times over (the `poster`, the sharp still under the video and the
 * blurred backdrop, one request between them). Routed through Next's image
 * optimizer the same file comes back as a 1080-wide WebP of about 10 KB
 * (measured 7 Sep 2026: 170,713 bytes to 10,592), which is the difference
 * between a card that paints on arrival and one that waits on the network.
 *
 * `/feed/browse` already sends these URLs through `next/image`, so the hosts
 * are whitelisted in `next.config.mjs` and the optimizer is already in use;
 * this only lets a plain `<img>` and a `<video poster>` share that path. The
 * width is one of Next's default `deviceSizes`, which is what the optimizer
 * accepts; 1080 covers a phone at 3x and reads sharp on a laptop, and the
 * video takes over the moment it has frames anyway.
 *
 * Pure: no window, no config, so it renders identically on the server.
 */

/** A width from Next's default `deviceSizes`; the optimizer rejects others. */
export const THUMBNAIL_WIDTH = 1080;
/** Matches next/image's default quality. */
export const THUMBNAIL_QUALITY = 75;

export function thumbnailSrc(
  url: string,
  width: number = THUMBNAIL_WIDTH,
  quality: number = THUMBNAIL_QUALITY,
): string {
  // Relative and data URLs are left alone: the optimizer only serves
  // whitelisted remote hosts, and a broken poster is worse than a large one.
  if (!/^https?:\/\//.test(url)) return url;
  return `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=${quality}`;
}
