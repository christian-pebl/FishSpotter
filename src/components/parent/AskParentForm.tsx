"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CONSENT_REQUEST_TTL_WORDS,
  type ConsentSummary,
  type ParentalConsentPurpose,
} from "@/lib/parental-consent-shared";
import { PARENT_REQUESTED_EVENT, type ParentRequestedDetail } from "@/lib/age-events";
import { SUPPORT_EMAIL } from "@/lib/email/outcome";

/**
 * A child asks a parent or carer for their OK (POST /api/parent/request).
 *
 * Written for the child reading it: short sentences, what happens next, and
 * what we do with the grown-up's address (Children's Code, transparency at
 * the point of collection). The parent gets the full notice by email.
 *
 * For a prize request from a child whose account a parent already saved, the
 * request can go to that same grown-up without the child typing, or seeing,
 * their address.
 */

type Phase = "loading" | "form" | "sent" | "not-sent" | "granted";

export function AskParentForm({
  purpose,
  onClose,
}: {
  purpose: ParentalConsentPurpose;
  onClose?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [pendingAlready, setPendingAlready] = useState(false);
  const [canReuseAccountParent, setCanReuseAccountParent] = useState(false);
  const [typeNew, setTypeNew] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/parent/status", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<ConsentSummary>) : null))
      .then((s) => {
        if (cancelled) return;
        if (s?.[purpose] === "granted") {
          setPhase("granted");
          return;
        }
        setPendingAlready(s?.[purpose] === "pending");
        setCanReuseAccountParent(purpose === "prize" && s?.account === "granted");
        setPhase("form");
      })
      .catch(() => {
        if (!cancelled) setPhase("form");
      });
    return () => {
      cancelled = true;
    };
  }, [purpose]);

  const reuse = canReuseAccountParent && !typeNew;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const addr = email.trim();
    if (!reuse && !addr) {
      setError("Enter your grown-up's email address.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/parent/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reuse ? { purpose } : { purpose, parentEmail: addr }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        emailSent?: boolean;
        alreadyGranted?: boolean;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "That didn't work. Please try again.");
        return;
      }
      if (data.alreadyGranted) {
        setPhase("granted");
        return;
      }
      const emailSent = data.emailSent !== false;
      window.dispatchEvent(
        new CustomEvent<ParentRequestedDetail>(PARENT_REQUESTED_EVENT, {
          detail: { purpose, emailSent },
        }),
      );
      setPhase(emailSent ? "sent" : "not-sent");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const doneButton = onClose ? (
    <button
      type="button"
      onClick={onClose}
      className="pebl-button-primary mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold"
    >
      Keep spotting
    </button>
  ) : null;

  if (phase === "loading") {
    return <p className="mt-3 text-sm text-navy-900/60">One moment…</p>;
  }

  if (phase === "granted") {
    return (
      <>
        <p className="mt-2 text-sm text-navy-900/75">
          {purpose === "prize"
            ? "Your grown-up has already said yes to the prize."
            : "Your grown-up has already saved your account. They can sign you in on any device from fishspotter.app/parent."}
        </p>
        {doneButton}
      </>
    );
  }

  if (phase === "sent" || phase === "not-sent") {
    return (
      <>
        <p className="mt-2 text-sm text-navy-900/75" role="status">
          {phase === "sent" ? (
            <>
              Done! We&apos;ve emailed them. Ask them to check their inbox, and their junk folder
              too. {purpose === "prize"
                ? "Once they say yes, you can claim your prize here."
                : "Once they say yes, your progress is saved for good."}
            </>
          ) : (
            <>
              We couldn&apos;t send the email just now. Ask your grown-up to email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
                {SUPPORT_EMAIL}
              </a>{" "}
              and we&apos;ll sort it out.
            </>
          )}
        </p>
        {doneButton}
      </>
    );
  }

  return (
    <form onSubmit={send} className="mt-3">
      {pendingAlready ? (
        <p className="mb-2 rounded-modal bg-surface-muted px-3 py-2 text-xs text-navy-900/80">
          We&apos;ve already emailed a grown-up and are waiting for them. You can send it again, or
          to someone else.
        </p>
      ) : null}
      <p className="text-sm text-navy-900/75">
        We&apos;ll send them one email about FishSpotter, asking if it&apos;s OK. We only use their
        address for this. If they don&apos;t answer within {CONSENT_REQUEST_TTL_WORDS}, we delete it.
      </p>

      {reuse ? (
        <p className="mt-3 text-sm text-navy-900">
          We&apos;ll ask the grown-up who saved your account.{" "}
          <button
            type="button"
            onClick={() => setTypeNew(true)}
            className="inline-flex min-h-[44px] items-center text-teal-700 underline underline-offset-2 hover:text-navy-900"
          >
            Ask someone else
          </button>
        </p>
      ) : (
        <>
          <label htmlFor={`parent-email-${purpose}`} className="mt-3 block text-sm font-medium text-navy-900">
            Your parent or carer&apos;s email
          </label>
          <input
            id={`parent-email-${purpose}`}
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            placeholder="grown-up@example.com"
            autoComplete="off"
            className="mt-1 w-full rounded-modal border border-navy-900/15 bg-white px-3 py-2.5 text-base text-navy-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
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
        disabled={busy}
        className="pebl-button-primary mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold shadow-glow transition-shadow hover:shadow-glow-strong disabled:opacity-60"
      >
        {busy ? "Sending…" : pendingAlready ? "Send it again" : "Email my grown-up"}
      </button>
      <p className="mt-2 text-xs text-navy-900/60">
        Grown-ups can read how we look after children&apos;s information in our{" "}
        <Link href="/privacy#children" className="underline">
          privacy policy
        </Link>
        .
      </p>
    </form>
  );
}
