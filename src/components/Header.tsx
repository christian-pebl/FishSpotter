"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SideMenu } from "@/components/SideMenu";
import { PebbleBag } from "@/components/PebbleBag";

const overlayTextShadow = "0 1px 3px rgba(0,0,0,0.55)";

export function Header() {
  const pathname = usePathname() ?? "/";
  // Overlay style (transparent, video fills viewport) only on the live feed.
  // Browse / archive / other pages keep the standard slim solid bar.
  const onFeed = pathname === "/feed";
  const [menuOpen, setMenuOpen] = useState(false);

  // On /feed: render as a fully transparent overlay so the video fills the
  // viewport with no scrim or blur over the top of the clip. The menu button and
  // logo stay legible via their own text / drop shadows. Elsewhere: slim solid bar.
  const wrapClass = onFeed
    ? "pointer-events-none absolute inset-x-0 top-0 z-40 pb-1"
    : "relative z-40 border-b border-[color:var(--border)] bg-[color:var(--surface)]/88 backdrop-blur";

  return (
    <>
      <header
        className={wrapClass}
        style={onFeed ? { paddingTop: "max(0.4rem, env(safe-area-inset-top))" } : undefined}
      >
        <div
          className={`mx-auto flex max-w-6xl items-center justify-between gap-2 py-1.5 pl-3 ${
            onFeed ? "pr-7" : "pr-3"
          }`}
        >
          {/* Left: the one menu button + the FishSpotter · by PEBL brand lockup.
              PEBL branding now lives here as a subtitle (the pebble-cairn score
              on the right already carries PEBL's mark), so the top-right holds
              only the score. Settings + account/sign-in live inside the side
              menu opened from here, not in the top bar. */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              className={`pointer-events-auto inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full ${
                onFeed
                  ? "text-white hover:bg-white/10"
                  : "text-[color:var(--foreground)] hover:bg-[color:var(--surface-muted)]"
              }`}
              style={onFeed ? { textShadow: overlayTextShadow } : undefined}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path
                  d="M3 5h12M3 9h12M3 13h12"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            {/* Two-line lockup, vertically centred as a block. The balancing
                "by PEBL" line also settles the wordmark's optical alignment
                against the rest of the bar (the display font sat a touch high
                as a lone single line). */}
            <Link
              href="/"
              aria-label="FishSpotter, by PEBL. Home."
              className="pointer-events-auto flex flex-col justify-center"
              style={onFeed ? { textShadow: overlayTextShadow } : undefined}
            >
              <span
                className={`font-display text-xl leading-none tracking-wide ${
                  onFeed ? "text-white" : "text-teal-600"
                }`}
              >
                FishSpotter
              </span>
              {/* "by" + the real PEBL logo (recoloured via CSS mask so the
                  wordmark inherits the subtitle colour: white on the feed
                  overlay, muted teal elsewhere). */}
              <span
                className={`mt-1 flex items-center gap-1 text-[10px] font-semibold uppercase leading-none tracking-[0.15em] ${
                  onFeed ? "text-white/75" : "text-[color:var(--muted)]"
                }`}
              >
                by
                <span
                  aria-hidden
                  className="block h-3.5 w-[42px] bg-current"
                  style={{
                    WebkitMaskImage: "url('/branding/PEBL Logo-1.svg')",
                    maskImage: "url('/branding/PEBL Logo-1.svg')",
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                    WebkitMaskPosition: "left center",
                    maskPosition: "left center",
                    WebkitMaskSize: "contain",
                    maskSize: "contain",
                  }}
                />
              </span>
            </Link>
          </div>

          {/* Right cluster: the Pebble score only (its cairn icon is PEBL's
              brand mark). Empty for signed-out guests, which keeps the bar clean. */}
          <div className="flex items-center">
            <PebbleBag onFeed={onFeed} />
          </div>
        </div>
      </header>
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
