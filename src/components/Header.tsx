"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AvatarMenu } from "@/components/AvatarMenu";
import { SettingsMenu } from "@/components/SettingsMenu";
import { SideMenu } from "@/components/SideMenu";

const overlayTextShadow = "0 1px 3px rgba(0,0,0,0.55)";

export function Header() {
  const pathname = usePathname() ?? "/";
  // Overlay style (transparent, video fills viewport) only on the live feed.
  // Browse / archive / other pages keep the standard slim solid bar.
  const onFeed = pathname === "/feed";
  const showSettings = onFeed;
  const [menuOpen, setMenuOpen] = useState(false);

  // On /feed: render as a transparent overlay so the video fills the viewport.
  // Elsewhere: render a slim solid bar.
  const wrapClass = onFeed
    ? "pointer-events-none absolute inset-x-0 top-0 z-40 bg-gradient-to-b from-black/40 via-black/15 to-transparent pb-3 backdrop-blur-[2px]"
    : "relative z-40 border-b border-[color:var(--border)] bg-[color:var(--surface)]/88 backdrop-blur";

  return (
    <>
      <header
        className={wrapClass}
        style={onFeed ? { paddingTop: "max(0.5rem, env(safe-area-inset-top))" } : undefined}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2">
          {/* Left: back-arrow → opens drawer */}
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
                d="M11.25 4L6 9l5.25 5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Center: PEBL wordmark */}
          <Link
            href="/"
            aria-label="PEBL FishSpotter home"
            className="pointer-events-auto inline-flex shrink-0 items-center justify-center"
            style={onFeed ? { filter: `drop-shadow(${overlayTextShadow})` } : undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/branding/PEBL Logo-1.svg"
              alt=""
              aria-hidden
              className={onFeed ? "h-7 w-auto opacity-30 md:h-8" : "h-7 w-auto md:h-9"}
            />
          </Link>

          {/* Right: settings kebab (feed only) + avatar (everywhere) */}
          <div className="pointer-events-auto flex items-center gap-1">
            {showSettings && <SettingsMenu />}
            <AvatarMenu overlay={onFeed} />
          </div>
        </div>
      </header>
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
