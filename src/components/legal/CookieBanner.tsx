"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Kept in sync with src/lib/cookies/consent.ts. Inlined here so this
// client component doesn't import the server-only `cookies` helper.
const CONSENT_COOKIE = "pebl_consent";
const TWELVE_MONTHS_SECS = 60 * 60 * 24 * 365;

function hasConsentCookie(): boolean {
  return document.cookie.includes(`${CONSENT_COOKIE}=`);
}

// The server can never know a visitor's cookie (this page is static/ISR --
// see the layout.tsx comment on why), so it always renders "no banner" as
// the SSR-safe baseline. Checking document.cookie in a useState lazy
// initializer looks tempting (and was tried here first) but is wrong: on
// the client's FIRST render pass -- the one hydration diffs against the
// server HTML -- a returning visitor's cookie would already make it want
// to render null while the server rendered the full banner. That is a
// structural hydration mismatch (a whole subtree vs. null, not just a text
// diff), and React does not reliably clean up the resulting orphaned DOM:
// the leftover server-rendered banner stays in the document with no fiber
// attached to it, so it never responds to clicks again. Deferring the real
// check to a useEffect keeps the client's first render identical to the
// server's (both render null/hidden), so hydration always succeeds; the
// effect then corrects the state via a normal post-mount re-render, which
// uses ordinary reconciliation instead of hydration reconciliation.
export function CookieBanner() {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDismissed(hasConsentCookie());
  }, []);

  // Belt-and-braces: if the cookie was set in another tab while this
  // tab is open, hide the banner on focus.
  useEffect(() => {
    if (!mounted || dismissed) return;
    const onFocus = () => {
      if (hasConsentCookie()) setDismissed(true);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [mounted, dismissed]);

  const save = (analytics: boolean) => {
    const value = JSON.stringify({
      v: 1,
      ts: Date.now(),
      essential: true,
      analytics,
    });
    document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(value)}; max-age=${TWELVE_MONTHS_SECS}; path=/; SameSite=Lax`;
    setDismissed(true);
  };

  if (!mounted || dismissed) return null;

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed inset-x-2 bottom-2 z-[60] mx-auto max-w-2xl pebl-surface rounded-card border border-navy-900/12 p-4 text-sm shadow-card"
    >
      <p className="text-navy-900">
        FishSpotter keeps one strictly-necessary cookie to sign you in. May we also
        count anonymous usage — clips watched, species spotted — to show our funder
        the project&apos;s impact? No third-party tracking, ever. See our{" "}
        <Link href="/privacy" className="text-teal-700 underline">
          privacy policy
        </Link>
        .
      </p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => save(false)}
          className="pebl-button-secondary px-3 py-1.5 text-xs"
        >
          Essential only
        </button>
        <button
          type="button"
          onClick={() => save(true)}
          className="pebl-button-primary px-3 py-1.5 text-xs"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
