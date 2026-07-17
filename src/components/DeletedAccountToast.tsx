"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Confirms a just-completed account deletion. AccountClient redirects to
 * "/?deleted=1" after DELETE /api/account succeeds, but previously nothing
 * rendered that confirmation -- the user just landed back on the homepage
 * with an inert query param. Mirrors VerificationBanner's dismissible
 * fixed bottom-card pattern.
 *
 * Reads the query param client-side (useSearchParams, wrapped in its own
 * Suspense boundary below) rather than as a server-computed prop: the
 * homepage is otherwise fully static (export const revalidate = 60), and
 * reading searchParams in the Server Component would force it dynamic on
 * every request -- the same Cache-Control: no-store trap that disabled
 * back/forward cache site-wide (2026-07-16 audit finding).
 */
function DeletedAccountToastInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const show = searchParams.get("deleted") === "1";
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    if (!show) return;
    // Strip the param so a refresh or back-nav doesn't re-show this.
    router.replace("/", { scroll: false });
  }, [show, router]);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="pointer-events-auto fixed inset-x-2 bottom-2 z-[55] mx-auto flex max-w-md items-start gap-3 rounded-card border border-navy-900/12 bg-[color:var(--surface)] p-3 text-xs text-navy-900 shadow-card"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-teal-600"
      >
        <path
          d="M5 13l4 4L19 7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Account deleted</p>
        <p className="mt-0.5 text-navy-900/72">
          Your account and every answer you submitted have been permanently removed.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
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

export function DeletedAccountToast() {
  return (
    <Suspense fallback={null}>
      <DeletedAccountToastInner />
    </Suspense>
  );
}
