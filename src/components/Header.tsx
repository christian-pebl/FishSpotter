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
          {/* Left: the one menu button + a small FishSpotter brand wordmark.
              Settings + account/sign-in live inside the side menu (opened from
              here), not in the top bar. */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              className={`pointer-events-auto inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full ${
                onFeed
                  ? "text-white/90 hover:bg-white/10"
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
            <Link
              href="/"
              aria-label="FishSpotter home"
              className={`pointer-events-auto font-display text-xl leading-none tracking-wide ${
                onFeed ? "text-white" : "text-teal-600"
              }`}
              style={onFeed ? { textShadow: overlayTextShadow } : undefined}
            >
              FishSpotter
            </Link>
          </div>

          {/* Right cluster: a faint PEBL logo (links home), nudged left to make
              way for the Pebble bag pinned in the top-right corner. */}
          <div className="flex items-center gap-1">
            <Link
              href="/"
              aria-label="PEBL"
              className={`pointer-events-auto -mr-1 inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full px-1 ${
                onFeed ? "hover:bg-white/10" : "hover:bg-[color:var(--surface-muted)]"
              }`}
              style={onFeed ? { filter: `drop-shadow(${overlayTextShadow})` } : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/branding/PEBL Logo-1.svg"
                alt=""
                aria-hidden
                className="h-4 w-auto opacity-30"
              />
            </Link>
            <PebbleBag onFeed={onFeed} />
          </div>
        </div>
      </header>
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
