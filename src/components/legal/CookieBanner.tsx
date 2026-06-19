"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Kept in sync with src/lib/cookies/consent.ts. Inlined here so this
// client component doesn't import the server-only `cookies` helper.
const CONSENT_COOKIE = "pebl_consent";
const TWELVE_MONTHS_SECS = 60 * 60 * 24 * 365;

interface Props {
  initiallyDismissed: boolean;
}

export function CookieBanner({ initiallyDismissed }: Props) {
  const [dismissed, setDismissed] = useState(initiallyDismissed);

  // Belt-and-braces: if the cookie was set in another tab while this
  // tab is open, hide the banner on focus.
  useEffect(() => {
    if (dismissed) return;
    const onFocus = () => {
      if (document.cookie.includes(`${CONSENT_COOKIE}=`)) setDismissed(true);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [dismissed]);

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

  if (dismissed) return null;

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
