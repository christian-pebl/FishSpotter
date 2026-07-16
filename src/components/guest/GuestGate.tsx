"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useModalFocus } from "@/lib/useModalFocus";

/**
 * Zero-friction entry: when a signed-out spotter reaches the feed, ask only for
 * a username. Submitting mints a guest account (guest branch in src/lib/auth.ts)
 * so their guesses persist and they appear on the leaderboard immediately — no
 * email, no password. Dismissable ("just watch") and remembered per tab so it
 * doesn't nag; existing users get a sign-in link.
 */

const DISMISS_KEY = "fishspotter:guestGateDismissed";
const MAX_NAME = 24;

export function GuestGate() {
  const { status } = useSession();
  const router = useRouter();
  // Start hidden so there's no SSR/first-paint flash before we know auth state.
  const [dismissed, setDismissed] = useState(true);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status !== "unauthenticated") return;
    let already = false;
    try {
      already = sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* private mode / disabled storage — just show it */
    }
    setDismissed(already);
  }, [status]);

  const open = status === "unauthenticated" && !dismissed;

  function close() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  useModalFocus(open, dialogRef, close);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    const username = name.trim();
    if (!username) {
      setError("Pick a username to start.");
      return;
    }
    setSubmitting(true);
    setError("");
    const res = await signIn("credentials", {
      guest: "true",
      name: username,
      redirect: false,
    });
    setSubmitting(false);
    if (!res || res.error) {
      setError("Could not start just now. Please try again.");
      return;
    }
    try {
      sessionStorage.removeItem(DISMISS_KEY);
    } catch {
      /* ignore */
    }
    // Session flips to authenticated (guest); the overlay unmounts itself.
    router.refresh();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/60 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-gate-title"
    >
      <div
        ref={dialogRef}
        className="pebl-surface w-full max-w-sm rounded-card p-6 shadow-panel"
      >
        <p className="pebl-eyebrow text-xs">Join in</p>
        <h2
          id="guest-gate-title"
          className="mt-1 font-brand-heading text-2xl font-bold text-navy-900"
        >
          Pick a username to start
        </h2>
        <p className="mt-1.5 text-sm text-navy-900/70">
          No account needed. Start spotting now and climb the leaderboard, then
          save your progress later.
        </p>

        <form onSubmit={start} className="mt-4">
          <label htmlFor="guest-name" className="sr-only">
            Username
          </label>
          <input
            id="guest-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value.slice(0, MAX_NAME));
              setError("");
            }}
            placeholder="e.g. ReefRanger"
            autoComplete="off"
            maxLength={MAX_NAME}
            className="w-full rounded-modal border border-navy-900/15 bg-white px-3 py-2.5 text-base text-navy-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
          />
          {error && (
            <p className="mt-1.5 text-xs text-incorrect-ink" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="pebl-button-primary mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold shadow-glow transition-shadow hover:shadow-glow-strong disabled:opacity-60"
          >
            {submitting ? "Starting…" : "Start spotting"}
          </button>
        </form>

        <div className="mt-3 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={close}
            className="min-h-[44px] text-navy-900/60 underline underline-offset-2 hover:text-navy-900"
          >
            Just watch for now
          </button>
          <Link
            href="/auth/signin"
            className="min-h-[44px] text-teal-700 underline underline-offset-2 hover:text-navy-900"
          >
            I have an account
          </Link>
        </div>
      </div>
    </div>
  );
}
