/**
 * Shared helpers for the local source cache.
 *
 * These live in their own module rather than in prefetch-sources.ts because
 * that script runs a `main()` at module scope: importing it just to borrow a
 * filename helper silently kicked off a full 339-source refetch. A helper that
 * cannot be imported without doing work is not a helper.
 */

/** A source id is not a safe filename (colons, slashes), so flatten it. */
export const safeName = (id: string) => id.replace(/[^a-zA-Z0-9._-]+/g, "_");

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "-",
  mdash: "-",
  rsquo: "'",
  lsquo: "'",
  ldquo: '"',
  rdquo: '"',
  hellip: "...",
  deg: " deg ",
  plusmn: "+/-",
  times: "x",
  micro: "u",
  eacute: "e",
};

/**
 * HTML -> the words a reader would see, in reading order.
 *
 * Reduced to text at CACHE time, not at read time: the point of the cache is
 * that whatever checks a claim next sees the same words a person would, with
 * no markup to skip and no chance of matching a claim against a class name or
 * a nav label.
 */
export function htmlToText(html: string): string {
  let s = html;
  // Order matters: kill the non-content elements whole before unwrapping tags,
  // or their contents survive as stray text.
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(/<(script|style|noscript|svg|head)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  // Block-level boundaries become newlines so sections stay separable; a table
  // cell becomes a tab so FishBase's label/value rows survive as pairs.
  s = s.replace(/<\/(p|div|section|article|li|tr|h[1-6]|table|blockquote)>/gi, "\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(td|th)>/gi, "\t");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
  s = s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  s = s.replace(/&([a-z]+);/gi, (m, e: string) => ENTITIES[e.toLowerCase()] ?? m);
  s = s.replace(/[ \t ]+/g, " ");
  s = s.replace(/ *\n[ \n]*/g, "\n");
  return s.trim();
}
