"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PebbleBag } from "@/components/PebbleBag";
import { useAfterFirstPaint } from "@/lib/useAfterFirstPaint";
import { useLazyComponent } from "@/lib/useLazyComponent";

const overlayTextShadow = "0 1px 3px rgba(0,0,0,0.55)";

// The side menu is the one piece of the header that pulls in framer-motion
// (41 KB over the wire), and it is invisible until opened. It is fetched after
// the page's first paint, or the moment the menu button is touched, whichever
// comes first, so it is never in the way of what a visitor is waiting to see.
// The browser's install offer, which the menu used to catch itself, is caught by
// PwaRegister instead (src/lib/useInstallPrompt.ts), so nothing is lost while
// the menu is on its way.
const loadSideMenu = () => import("@/components/SideMenu").then((m) => m.SideMenu);

export function Header() {
  const pathname = usePathname() ?? "/";
  // Overlay style (transparent, video fills viewport) only on the live feed.
  // Browse / archive / other pages keep the standard slim solid bar.
  const onFeed = pathname === "/feed";
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const painted = useAfterFirstPaint();
  const [SideMenu, requestSideMenu] = useLazyComponent(loadSideMenu);

  useEffect(() => {
    if (painted) requestSideMenu();
  }, [painted, requestSideMenu]);

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
              onClick={() => {
                // If the menu's code is still on its way (a slow connection, a
                // very early tap), it appears already open as soon as it lands.
                requestSideMenu();
                setMenuOpen(true);
              }}
              // Warm it a beat before the click lands.
              onPointerEnter={requestSideMenu}
              onPointerDown={requestSideMenu}
              onFocus={requestSideMenu}
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
            {/* Single-line lockup: FishSpotter + a small "by" + the real PEBL
                logo, all on one row and vertically centred against the menu
                button. The PEBL logo is recoloured via CSS mask so the wordmark
                inherits the lockup colour (white on the feed overlay, muted teal
                elsewhere). */}
            <Link
              href="/"
              aria-label="FishSpotter, by PEBL. Home."
              className="pointer-events-auto flex items-center gap-1.5"
              style={onFeed ? { textShadow: overlayTextShadow } : undefined}
            >
              <span
                className={`font-display text-xl leading-none tracking-wide ${
                  onFeed ? "text-white" : "text-teal-600"
                }`}
              >
                FishSpotter
              </span>
              <span
                className={`flex items-center gap-1 text-[10px] font-semibold lowercase leading-none tracking-[0.08em] ${
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
      {SideMenu && <SideMenu open={menuOpen} onClose={closeMenu} />}
    </>
  );
}
