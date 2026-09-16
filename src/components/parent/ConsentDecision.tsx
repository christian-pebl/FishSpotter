"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ParentalConsentPurpose } from "@/lib/parental-consent-shared";

/**
 * The parent's yes or no (POST /api/parent/consent), as two buttons and no
 * form to fill in. The yes button carries the declaration (parent or carer,
 * 18 or over, and for a prize a UK address), stated in the line above it, so
 * agreeing is one deliberate tap. On a yes the parent goes straight on to the
 * manage page; the confirmation email follows a day later.
 */
export function ConsentDecision({
  token,
  purpose,
  childName,
}: {
  token: string;
  purpose: ParentalConsentPurpose;
  childName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"grant" | "decline" | null>(null);
  const [error, setError] = useState("");
  const [declined, setDeclined] = useState(false);
  const isPrize = purpose === "prize";

  async function decide(decision: "grant" | "decline") {
    setBusy(decision);
    setError("");
    try {
      const res = await fetch("/api/parent/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          decision === "grant"
            ? { token, decision, confirmParent: true, ukAddress: isPrize }
            : { token, decision },
        ),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        manageToken?: string | null;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "That didn't work. Please try again.");
        return;
      }
      if (decision === "decline") {
        setDeclined(true);
        return;
      }
      router.replace(data.manageToken ? `/parent/manage/${data.manageToken}?agreed=1` : "/parent");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (declined) {
    return (
      <p className="mt-5 rounded-modal bg-surface-muted p-4 text-sm text-navy-900" role="status">
        Thank you. We&apos;ve deleted your email address and this request.{" "}
        {isPrize
          ? `We won't post anything to ${childName}.`
          : `${childName} can still play on their own device; we just won't keep their account for good.`}
      </p>
    );
  }

  return (
    <div className="mt-5">
      <p className="text-xs leading-5 text-navy-900/70">
        By saying yes you confirm you are {childName}&apos;s parent or carer and 18 or over
        {isPrize ? ", and that the book can be posted to a UK address you'll give us by email" : ""}.
      </p>
      {error && (
        <p className="mt-2 text-sm text-incorrect-ink" role="alert">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => decide("grant")}
          className="pebl-button-primary inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full px-6 text-sm font-semibold disabled:opacity-50"
        >
          {busy === "grant" ? "Saving…" : isPrize ? "Yes, post the prize" : `Yes, keep ${childName}'s account`}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => decide("decline")}
          className="pebl-button-secondary inline-flex min-h-[44px] items-center justify-center rounded-full px-6 text-sm font-semibold disabled:opacity-50"
        >
          {busy === "decline" ? "Saving…" : "No thanks"}
        </button>
      </div>
    </div>
  );
}
