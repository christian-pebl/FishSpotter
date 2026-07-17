"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "fs.verify_banner_dismissed";

/**
 * Post-signup nudge (T5): a brand-new user is sent straight to the feed with
 * no confirmation that a verification email went out. This dismissible banner
 * tells them to check their inbox and lets them resend. Rendered fixed so the
 * feed's overflow-hidden immersive layout can't clip it. Dismissal is sticky
 * for the browser session so it does not nag on every navigation.
 *
 * `dismissed` is read from sessionStorage in a useEffect, not a useState
 * lazy initializer: the server always renders with dismissed=false (it has
 * no sessionStorage), so if the client's FIRST render read a "true" value
 * instead, that's a structural hydration mismatch (a whole subtree vs.
 * null) that React can leave as an orphaned, un-hydrated DOM node -- see
 * the identical bug + full writeup in CookieBanner.tsx. Deferring to an
 * effect keeps the first client render identical to the server's.
 */
export function VerificationBanner({ unverified }: { unverified: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "rate-limited" | "error">("idle");

  useEffect(() => {
    try {
      setDismissed(window.sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      // sessionStorage unavailable (private mode quota) — leave dismissed=false.
    }
  }, []);

  if (!unverified || dismissed) return null;

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // sessionStorage unavailable (private mode quota) — dismiss for this view only.
    }
    setDismissed(true);
  };

  const resend = async () => {
    setStatus("sending");
    try {
      const res = await fetch("/api/auth/verify-request", { method: "POST" });
      setStatus(res.ok ? "sent" : res.status === 429 ? "rate-limited" : "error");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div
      role="status"
      className="pointer-events-auto fixed inset-x-2 bottom-2 z-[55] mx-auto flex max-w-md items-start gap-3 rounded-card border border-navy-900/12 bg-[color:var(--surface)] p-3 text-xs text-navy-900 shadow-card"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-0.5 shrink-0 text-teal-600">
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Optional: verify your email</p>
        <p className="mt-0.5 text-navy-900/72">
          Verify to get the weekly digest. You can keep spotting without it.
        </p>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={resend}
            disabled={status === "sending" || status === "sent"}
            className="inline-flex min-h-[44px] items-center font-semibold text-teal-700 underline hover:text-navy-900 disabled:no-underline disabled:opacity-60"
          >
            {status === "sent"
              ? "Email sent"
              : status === "sending"
                ? "Sending…"
                : status === "rate-limited"
                  ? "Try again later"
                  : status === "error"
                    ? "Could not send — retry"
                    : "Resend email"}
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-navy-900/55 hover:bg-[color:var(--surface-muted)] hover:text-navy-900"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
