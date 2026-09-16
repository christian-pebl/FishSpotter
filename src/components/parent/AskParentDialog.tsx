"use client";

import { useEffect, useRef, useState } from "react";
import { useModalFocus } from "@/lib/useModalFocus";
import { AskParentForm } from "@/components/parent/AskParentForm";
import { PARENT_REQUEST_EVENT, type ParentRequestDetail } from "@/lib/age-events";
import type { ParentalConsentPurpose } from "@/lib/parental-consent-shared";

const TITLE: Record<ParentalConsentPurpose, string> = {
  account: "Ask a grown-up to save your progress",
  prize: "Ask a grown-up about your prize",
};

const INTRO: Record<ParentalConsentPurpose, string> = {
  account:
    "Because you're under 13, a parent or carer needs to say yes before we keep your account for good.",
  prize: "Because you're under 18, a parent or carer needs to say yes before we post you anything.",
};

/**
 * The one "ask a parent or carer" dialog, mounted in the root layout and
 * opened from anywhere with requestParentConsent() (src/lib/age-events.ts).
 */
export function AskParentDialog() {
  const [purpose, setPurpose] = useState<ParentalConsentPurpose | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onRequest(e: Event) {
      const detail = (e as CustomEvent<ParentRequestDetail>).detail;
      if (detail?.purpose === "account" || detail?.purpose === "prize") setPurpose(detail.purpose);
    }
    window.addEventListener(PARENT_REQUEST_EVENT, onRequest);
    return () => window.removeEventListener(PARENT_REQUEST_EVENT, onRequest);
  }, []);

  const close = () => setPurpose(null);
  useModalFocus(purpose !== null, dialogRef, close);

  if (!purpose) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-navy-900/60 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ask-parent-title"
    >
      <div ref={dialogRef} className="pebl-surface w-full max-w-sm rounded-card p-6 shadow-panel">
        <h2 id="ask-parent-title" className="font-brand-heading text-2xl font-bold text-navy-900">
          {TITLE[purpose]}
        </h2>
        <p className="mt-1.5 text-sm text-navy-900/70">{INTRO[purpose]}</p>
        {/* Keyed so switching purpose starts the form afresh. */}
        <AskParentForm key={purpose} purpose={purpose} onClose={close} />
        <button
          type="button"
          onClick={close}
          className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center text-xs text-navy-900/60 underline underline-offset-2 hover:text-navy-900"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
