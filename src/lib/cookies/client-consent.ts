"use client";

/**
 * Client-side reader for the analytics-consent flag (PECR/UK GDPR). The
 * server-side counterpart lives in src/lib/cookies/consent.ts, which imports the
 * server-only `next/headers`; this browser helper just parses document.cookie, so
 * the cookie name is inlined (same pattern as CookieBanner).
 *
 * Engagement tracking is gated on this returning true — no consent, no events.
 */
const CONSENT_COOKIE = "pebl_consent";

export function hasAnalyticsConsent(): boolean {
  if (typeof document === "undefined") return false;
  const match = document.cookie.match(/(?:^|; )pebl_consent=([^;]*)/);
  if (!match) return false;
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1]));
    return parsed?.v === 1 && parsed.analytics === true;
  } catch {
    return false;
  }
}

export { CONSENT_COOKIE };
