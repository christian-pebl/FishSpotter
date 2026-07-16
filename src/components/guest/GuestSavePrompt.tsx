"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useModalFocus } from "@/lib/useModalFocus";
import { GUEST_MILESTONE_EVENT } from "@/lib/guest";

/**
 * After a guest has spotted a few clips (GUEST_SAVE_PROMPT_AT — the quiz hook
 * fires GUEST_MILESTONE_EVENT), invite them to save their run with an email.
 * Email-only by design: POST /api/guest/claim attaches the address to their
 * existing account (points already persist) and mails a set-password link.
 * Then session.update() drops isGuest so this stops firing.
 */

const DISMISS_KEY = "fishspotter:guestSaveDismissed";

export function GuestSavePrompt() {
  const { data: session, update } = useSession();
  const isGuest = !!(session?.user as { isGuest?: boolean } | undefined)?.isGuest;
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [inUse, setInUse] = useState(false);
  const [done, setDone] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMilestone() {
      if (!isGuest) return;
      try {
        if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
      } catch {
        /* ignore */
      }
      setOpen(true);
    }
    window.addEventListener(GUEST_MILESTONE_EVENT, onMilestone);
    return () => window.removeEventListener(GUEST_MILESTONE_EVENT, onMilestone);
  }, [isGuest]);

  function close() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  useModalFocus(open, dialogRef, close);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const addr = email.trim();
    if (!addr) {
      setError("Enter your email.");
      return;
    }
    setSubmitting(true);
    setError("");
    setInUse(false);
    let res: Response;
    try {
      res = await fetch("/api/guest/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addr }),
      });
    } catch {
      setSubmitting(false);
      setError("Network error. Please try again.");
      return;
    }
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setInUse(data.code === "email_in_use");
      setError(data.error ?? "Could not save. Please try again.");
      return;
    }
    setDone(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    // Flip isGuest in the live session so the prompt won't re-fire.
    await update();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/60 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-save-title"
    >
      <div
        ref={dialogRef}
        className="pebl-surface w-full max-w-sm rounded-card p-6 shadow-panel"
      >
        {done ? (
          <>
            <h2
              id="guest-save-title"
              className="font-brand-heading text-2xl font-bold text-navy-900"
            >
              You&apos;re saved
            </h2>
            <p className="mt-2 text-sm text-navy-900/70">
              Your finds and leaderboard spot are attached to{" "}
              <span className="font-semibold text-navy-900">{email.trim()}</span>.
              Check your inbox for a link to set a password and finish up.
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="pebl-button-primary mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold"
            >
              Keep spotting
            </button>
          </>
        ) : (
          <>
            <p className="pebl-eyebrow text-xs">Nice spotting</p>
            <h2
              id="guest-save-title"
              className="mt-1 font-brand-heading text-2xl font-bold text-navy-900"
            >
              Save your progress
            </h2>
            <p className="mt-1.5 text-sm text-navy-900/70">
              You&apos;re on the leaderboard. Add your email to keep your spot and
              come back to it later. No password needed now.
            </p>

            <form onSubmit={save} className="mt-4">
              <label htmlFor="guest-email" className="sr-only">
                Email address
              </label>
              <input
                id="guest-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full rounded-modal border border-navy-900/15 bg-white px-3 py-2.5 text-base text-navy-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
              />
              {error && (
                <p className="mt-1.5 text-xs text-incorrect-ink" role="alert">
                  {error}{" "}
                  {inUse && (
                    <Link href="/auth/signin" className="underline">
                      Sign in
                    </Link>
                  )}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="pebl-button-primary mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold shadow-glow transition-shadow hover:shadow-glow-strong disabled:opacity-60"
              >
                {submitting ? "Saving…" : "Save my progress"}
              </button>
            </form>

            <button
              type="button"
              onClick={close}
              className="mt-3 min-h-[44px] text-xs text-navy-900/60 underline underline-offset-2 hover:text-navy-900"
            >
              Not now
            </button>
          </>
        )}
      </div>
    </div>
  );
}
