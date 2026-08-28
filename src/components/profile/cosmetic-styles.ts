import type { FrameId } from "@/lib/cosmetics";

/**
 * The visual half of the profile cosmetics.
 *
 * These live under src/components on purpose. Tailwind's `content` globs in
 * tailwind.config.ts only scan `src/pages`, `src/components` and `src/app`, so a
 * class string written anywhere in `src/lib` is never seen by the JIT compiler
 * and no CSS is generated for it. The markup then renders with the class name
 * present and nothing applied, which fails silently: the page looks fine, the
 * cosmetic is simply invisible. Caught 28 Aug 2026 by grepping the built CSS
 * bundle for `from-navy-600\/25` and finding zero matches.
 *
 * Keeping the class strings here also keeps src/lib/cosmetics.ts a genuinely
 * pure leaf: ids, thresholds and unlock rules there, presentation here.
 *
 * If a class map ever has to move back into src/lib, add the glob first.
 */

export interface FrameStyle {
  /** Ring treatment on the profile header card. */
  ring: string;
  /** Accent bar across the top of the card. Empty for no frame. */
  bar: string;
}

export const FRAME_STYLES: Readonly<Record<FrameId, FrameStyle>> = {
  none: { ring: "", bar: "" },
  kelp: {
    ring: "ring-1 ring-inset ring-teal-600/30",
    bar: "bg-gradient-to-r from-teal-600/70 via-teal-500/50 to-teal-600/20",
  },
  coral: {
    ring: "ring-2 ring-inset ring-teal-500/50",
    bar: "bg-gradient-to-r from-teal-500 via-teal-400 to-teal-600",
  },
  deep: {
    ring: "ring-2 ring-inset ring-navy-900/70",
    bar: "bg-gradient-to-r from-navy-900 via-teal-600 to-navy-900",
  },
};

export function frameStyle(id: FrameId): FrameStyle {
  return FRAME_STYLES[id] ?? FRAME_STYLES.none;
}

/**
 * Gradient washes for the profile header, one per survey site, all inside the
 * brand family. Deliberately abstract rather than photographic: PEBL has no
 * cleared per-site photography, and a wrong photo of a real place is worse than
 * none at all.
 *
 * Keyed on Snippet.site verbatim. An unknown site falls back to a neutral wash,
 * so adding a survey site degrades gracefully instead of rendering nothing.
 */
export const BACKDROP_WASHES: Readonly<Record<string, string>> = {
  "Ramsey Sound, Pembrokeshire, Wales, UK":
    "bg-gradient-to-br from-teal-600/25 via-teal-500/10 to-transparent",
  "Bideford Bay, North Devon, UK":
    "bg-gradient-to-br from-navy-600/25 via-teal-500/10 to-transparent",
  "Loch Sunart, Western Highlands, UK":
    "bg-gradient-to-br from-navy-900/25 via-navy-600/10 to-transparent",
  "Veerse Meer (Lake Veere), Zeeland, Netherlands":
    "bg-gradient-to-br from-teal-400/25 via-teal-50 to-transparent",
  "Blakeney Overfalls, Norfolk, UK":
    "bg-gradient-to-br from-navy-400/25 via-teal-500/10 to-transparent",
  "Pabay, Inner Sound, Isle of Skye, Scotland, UK":
    "bg-gradient-to-br from-navy-700/25 via-teal-400/10 to-transparent",
  "Dale Bay, Pembrokeshire, Wales, UK":
    "bg-gradient-to-br from-teal-500/25 via-teal-100 to-transparent",
  "East Pickard Bay, Pembrokeshire, Wales, UK":
    "bg-gradient-to-br from-teal-700/25 via-teal-500/10 to-transparent",
  "Freshwater West, Pembrokeshire, Wales, UK":
    "bg-gradient-to-br from-navy-500/25 via-teal-400/10 to-transparent",
};

export const DEFAULT_WASH =
  "bg-gradient-to-br from-teal-500/15 via-teal-50 to-transparent";

export function backdropWash(site: string | null | undefined): string {
  if (!site) return "";
  return BACKDROP_WASHES[site] ?? DEFAULT_WASH;
}
