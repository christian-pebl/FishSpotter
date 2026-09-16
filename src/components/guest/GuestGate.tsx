"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useModalFocus } from "@/lib/useModalFocus";
import { AgeBandPicker } from "@/components/age/AgeBandPicker";
import { isUnder13, parseAgeBand, type AgeBand } from "@/lib/age";
import { nicknameSuggestions } from "@/lib/nickname";
import { TAB_AGE_KEY } from "@/lib/age-events";

/**
 * Zero-friction entry: when a signed-out spotter reaches the feed, ask their
 * age group and a username. Submitting mints a guest account (guest branch in
 * src/lib/auth.ts) so their guesses persist at once, no email, no password.
 * Dismissable ("just watch") and remembered per tab so it doesn't nag;
 * existing users get a sign-in link.
 *
 * Age comes first (16 Sep 2026, Children's Code and COPPA). It decides what
 * the name may be and who sees it (src/lib/age.ts):
 *   under 13   picks one of our generated nicknames, never types one, since a
 *              child's typed username can be their real name. Private score.
 *   13 to 17   types a name, is reminded not to use their real one. Private
 *              score unless they switch it on later.
 *   18+        as before, on the public leaderboard.
 * The answer is held for the tab, so going round again does not offer a
 * different age.
 */

const DISMISS_KEY = "fishspotter:guestGateDismissed";
const MAX_NAME = 24;
const SUGGESTION_COUNT = 4;

function readTabAge(): AgeBand | null {
  try {
    return parseAgeBand(sessionStorage.getItem(TAB_AGE_KEY));
  } catch {
    return null;
  }
}

function writeTabAge(band: AgeBand) {
  try {
    sessionStorage.setItem(TAB_AGE_KEY, band);
  } catch {
    /* private mode: the server still stores the band */
  }
}

export function GuestGate() {
  const { status } = useSession();
  const router = useRouter();
  // Start hidden so there's no SSR/first-paint flash before we know auth state.
  const [dismissed, setDismissed] = useState(true);
  const [band, setBand] = useState<AgeBand | null>(null);
  const [name, setName] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status !== "unauthenticated") return;
    let already = false;
    try {
      already = sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* private mode / disabled storage, just show it */
    }
    setDismissed(already);
    const remembered = readTabAge();
    if (remembered) {
      setBand(remembered);
      if (isUnder13(remembered)) {
        const list = nicknameSuggestions(SUGGESTION_COUNT);
        setSuggestions(list);
        setName(list[0] ?? "");
      }
    }
  }, [status]);

  const open = status === "unauthenticated" && !dismissed;
  const child = isUnder13(band);

  function close() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  useModalFocus(open, dialogRef, close);

  function chooseBand(next: AgeBand) {
    setBand(next);
    writeTabAge(next);
    setError("");
    if (isUnder13(next)) {
      const list = nicknameSuggestions(SUGGESTION_COUNT);
      setSuggestions(list);
      setName(list[0] ?? "");
    }
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (!band) return;
    const username = name.trim();
    if (!username) {
      setError(child ? "Pick a nickname to start." : "Pick a username to start.");
      return;
    }
    setSubmitting(true);
    setError("");
    const res = await signIn("credentials", {
      guest: "true",
      name: username,
      ageBracket: band,
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
        {!band ? (
          <>
            <h2
              id="guest-gate-title"
              className="mt-1 font-brand-heading text-2xl font-bold text-navy-900"
            >
              How old are you?
            </h2>
            <p className="mt-1.5 text-sm text-navy-900/70">
              No account needed. We ask so we can keep FishSpotter right for your age. We only keep
              your age group.
            </p>
            <AgeBandPicker onPick={chooseBand} labelledBy="guest-gate-title" />
          </>
        ) : (
          <>
            <h2
              id="guest-gate-title"
              className="mt-1 font-brand-heading text-2xl font-bold text-navy-900"
            >
              {child ? "Pick your spotter nickname" : "Pick a username to start"}
            </h2>
            <p className="mt-1.5 text-sm text-navy-900/70">
              {child
                ? "Choose one of these. Your score is private: only you can see it."
                : band === "13_17"
                  ? "Don't use your real name. Your score stays private unless you choose to show it."
                  : "Start spotting now and climb the leaderboard, then save your progress later."}
            </p>

            <form onSubmit={start} className="mt-4">
              {child ? (
                <div role="radiogroup" aria-label="Nicknames" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={name === s}
                      onClick={() => setName(s)}
                      className={`inline-flex min-h-[44px] items-center justify-center rounded-full border px-2 text-sm font-semibold transition-colors ${
                        name === s
                          ? "border-teal-500 bg-teal-500/15 text-navy-900"
                          : "border-navy-900/15 bg-white text-navy-900/80 hover:border-teal-500"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const list = nicknameSuggestions(SUGGESTION_COUNT);
                      setSuggestions(list);
                      setName(list[0] ?? "");
                    }}
                    className="inline-flex min-h-[44px] items-center justify-center text-xs text-teal-700 sm:col-span-2 underline underline-offset-2 hover:text-navy-900"
                  >
                    Show me different ones
                  </button>
                </div>
              ) : (
                <>
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
                </>
              )}
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
          </>
        )}

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
            className="min-h-[44px] content-center text-teal-700 underline underline-offset-2 hover:text-navy-900"
          >
            I have an account
          </Link>
        </div>
        <p className="mt-1 text-center text-[11px] text-navy-900/55">
          <Link href="/privacy" className="underline">
            Privacy
          </Link>
          {" · "}
          <Link href="/parent" className="underline">
            For parents and carers
          </Link>
        </p>
      </div>
    </div>
  );
}
