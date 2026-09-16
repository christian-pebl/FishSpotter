"use client";

import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useModalFocus } from "@/lib/useModalFocus";
import { AgeBandPicker } from "@/components/age/AgeBandPicker";
import { AGE_UNKNOWN, type AgeBand } from "@/lib/age";
import {
  AGE_CHECK_REQUEST_EVENT,
  AGE_DECLARED_EVENT,
  requestParentConsent,
  type AgeDeclaredDetail,
} from "@/lib/age-events";

/**
 * One question, asked once, of every signed-in account with no age on record.
 *
 * Until 16 Sep 2026 guests were never asked, and 129 of 135 accounts had no
 * age at all, some of them children at US schools. The age decides what the
 * rest of the app may do (src/lib/age.ts), so it comes before anything else.
 * It cannot be dismissed, only answered or signed out of, and it stays out of
 * the way on the pages a parent or a curious child needs to read first.
 *
 * An under-13 answer removes the child's own email address from the account
 * (POST /api/account/age), so the follow-up says so plainly and offers the
 * parent route.
 */

/** Pages where the question waits, so the policies stay readable. */
const READ_FIRST_PREFIXES = [
  "/privacy",
  "/terms",
  "/prize-rules",
  "/parent",
  "/auth",
  "/about",
  "/accessibility",
];

type Stage = "ask" | "under13";

export function AgeCheck() {
  const { data: session, status, update } = useSession();
  const pathname = usePathname() ?? "/";
  const band = (session?.user as { ageBand?: string } | undefined)?.ageBand;
  const unknown = status === "authenticated" && (!band || band === AGE_UNKNOWN);
  const [requested, setRequested] = useState(false);
  const [stage, setStage] = useState<Stage>("ask");
  const [removedEmail, setRemovedEmail] = useState(false);
  const [newNickname, setNewNickname] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onRequest = () => setRequested(true);
    window.addEventListener(AGE_CHECK_REQUEST_EVENT, onRequest);
    return () => window.removeEventListener(AGE_CHECK_REQUEST_EVENT, onRequest);
  }, []);

  const readFirst = READ_FIRST_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const open = stage === "under13" || (unknown && (!readFirst || requested));

  // Answer or sign out; Escape does nothing here.
  useModalFocus(open, dialogRef, () => {});

  async function pick(ageBracket: AgeBand) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/account/age", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ageBracket }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        ageBand?: string;
        removedEmail?: boolean;
        newNickname?: string | null;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "That didn't save. Please try again.");
        return;
      }
      const saved = data.ageBand ?? ageBracket;
      window.dispatchEvent(
        new CustomEvent<AgeDeclaredDetail>(AGE_DECLARED_EVENT, {
          detail: {
            ageBand: saved,
            removedEmail: !!data.removedEmail,
            newNickname: data.newNickname ?? null,
          },
        }),
      );
      if (saved === "under_13") {
        setRemovedEmail(!!data.removedEmail);
        setNewNickname(data.newNickname ?? null);
        setStage("under13");
      }
      setRequested(false);
      await update();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      // Above every other overlay (the welcome tour sits at z-80): the age
      // decides what the rest of the app may do, so it is answered first.
      className="fixed inset-0 z-[100] flex items-end justify-center bg-navy-900/60 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-check-title"
    >
      <div ref={dialogRef} className="pebl-surface w-full max-w-sm rounded-card p-6 shadow-panel">
        {stage === "under13" ? (
          <>
            <h2 id="age-check-title" className="font-brand-heading text-2xl font-bold text-navy-900">
              Thanks for telling us
            </h2>
            <p className="mt-2 text-sm text-navy-900/75">
              {removedEmail
                ? "We've taken your email address off your account, because we need a parent or carer's OK before we keep one for anyone under 13. "
                : ""}
              Your finds and Pebbles are safe on this device. To keep them for good, ask a parent or
              carer to save your account. Your score stays private: only you can see it.
            </p>
            {newNickname ? (
              <p className="mt-2 text-sm text-navy-900/75">
                Your new spotter nickname is{" "}
                <strong className="text-navy-900">{newNickname}</strong>. You can pick a different
                one in your account.
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setStage("ask");
                requestParentConsent("account");
              }}
              className="pebl-button-primary mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold"
            >
              Ask a parent or carer
            </button>
            <button
              type="button"
              onClick={() => setStage("ask")}
              className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center text-sm text-navy-900/70 underline underline-offset-2 hover:text-navy-900"
            >
              Keep spotting
            </button>
          </>
        ) : (
          <>
            <p className="pebl-eyebrow text-xs">Quick one before you dive in</p>
            <h2
              id="age-check-title"
              className="mt-1 font-brand-heading text-2xl font-bold text-navy-900"
            >
              How old are you?
            </h2>
            <p className="mt-1.5 text-sm text-navy-900/70">
              We&apos;re asking everyone, once, so FishSpotter stays right for every age. We only
              keep your age group, never your birthday.
            </p>
            <AgeBandPicker onPick={pick} disabled={busy} labelledBy="age-check-title" />
            {error && (
              <p className="mt-2 text-xs text-incorrect-ink" role="alert">
                {error}
              </p>
            )}
            <p className="mt-2 text-[11px] text-navy-900/55">
              Tapped the wrong one? Email hello@pebl-cic.co.uk and we&apos;ll fix it.
            </p>
            <div className="mt-1 flex items-center justify-between text-xs">
              <Link
                href="/privacy#children"
                className="min-h-[44px] content-center text-teal-700 underline underline-offset-2 hover:text-navy-900"
              >
                Why we ask
              </Link>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="min-h-[44px] text-navy-900/60 underline underline-offset-2 hover:text-navy-900"
              >
                Sign out instead
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
