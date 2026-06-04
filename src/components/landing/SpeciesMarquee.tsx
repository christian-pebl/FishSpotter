"use client";

import { useState } from "react";
import { useInView } from "@/lib/useInView";

/**
 * Auto-scrolling strip of real cached reference photos ("what you'll
 * find down there"). Pure CSS marquee: the track holds two copies of the
 * list and translates -50% for a seamless loop, pausing on hover/focus.
 * prefers-reduced-motion (global) freezes it; useInView pauses it while
 * scrolled off-screen (CPU saver).
 *
 * Photos are CC-licensed iNaturalist / Wikimedia rows from SpeciesImage;
 * per-image attribution rides in the title attribute and a visible credit
 * line in the caption, with a blanket source/licence note under the strip.
 */

// Build a visible "© Author · CC BY" credit from the full attribution.
// Handles the formats SpeciesImage actually stores:
//   iNaturalist: "(c) Username, CC BY"  /  "© Username (CC0)"
//   Wikimedia:   "Author, CC BY-SA via Wikimedia Commons"
// CC-BY / CC-BY-SA need the author AND the licence visible, not just the
// name, so we surface both (the source link lives in the blanket line).
function creditLine(attr: string): string {
  let s = attr.replace(/\s*via Wikimedia Commons\s*$/i, "").trim();
  s = s.replace(/^\(c\)\s*/i, "").replace(/^©\s*/, "").trim();
  let name = s;
  let license = "";
  const comma = s.match(/^(.+?),\s*(.+)$/);
  const paren = s.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (comma) {
    name = comma[1].trim();
    license = comma[2].trim();
  } else if (paren) {
    name = paren[1].trim();
    license = paren[2].trim();
  }
  if (/no rights reserved/i.test(license)) license = "CC0";
  name = name || "Unknown";
  return license ? `© ${name} · ${license}` : `© ${name}`;
}

export type MarqueeSpecies = {
  url: string;
  name: string;
  attribution: string;
};

export function SpeciesMarquee({ species }: { species: MarqueeSpecies[] }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  // WCAG 2.2.2 (Level A): auto-scrolling content needs an explicit, always-
  // reachable pause control — hover/focus alone excludes touch and keyboard
  // users and ignores anyone who simply wants it to stop.
  const [paused, setPaused] = useState(false);
  if (species.length === 0) return null;
  // Duplicate for the seamless -50% loop.
  const loop = [...species, ...species];
  // Slow it down for longer lists so speed feels consistent.
  const duration = `${Math.max(28, species.length * 4)}s`;

  return (
    <div ref={ref} className={`fs-marquee relative overflow-hidden ${inView && !paused ? "" : "fs-paused"}`}>
      {/* Edge fades so cards melt into the page rather than hard-cropping. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-teal-50 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-teal-50 to-transparent" />
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        aria-label={paused ? "Resume the scrolling species strip" : "Pause the scrolling species strip"}
        className="absolute right-2 top-2 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full bg-navy-900/70 text-white backdrop-blur transition-colors hover:bg-navy-900/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
      >
        {paused ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M5 3.5l8 4.5-8 4.5z" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <rect x="3.5" y="3" width="3" height="10" rx="1" />
            <rect x="9.5" y="3" width="3" height="10" rx="1" />
          </svg>
        )}
      </button>

      <ul
        className="fs-marquee-track flex w-max gap-3"
        style={{ animationDuration: duration }}
      >
        {loop.map((s, i) => (
          // The second copy exists only for the seamless scroll loop; hide it
          // from the a11y tree so screen readers don't read every species twice.
          <li key={i} className="shrink-0" aria-hidden={i >= species.length ? "true" : undefined}>
            <figure
              className="relative h-40 w-32 overflow-hidden rounded-card border border-[color:var(--border)] shadow-card md:h-48 md:w-36"
              title={s.attribution}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.url}
                alt={s.name}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
              />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-900/95 to-transparent px-2 pb-2 pt-8">
                <span className="block truncate text-xs font-semibold text-white">{s.name}</span>
                <span className="block truncate text-[11px] text-white/80">{creditLine(s.attribution)}</span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </div>
  );
}
