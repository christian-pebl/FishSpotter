"use client";

import Link from "next/link";
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { MarineFrame } from "@/components/MarineFrame";

// Segment-level error boundary for /feed: a crash in the feed render (e.g. a
// snippet that somehow slips past the per-row safeParse guard) recovers in
// place here instead of bubbling to the root boundary and replacing the whole
// app shell. Keeps the user one tap from being back in the feed.
export default function FeedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    // No-op while SENTRY_DSN is unset (init() is disabled in that case).
    Sentry.captureException(error);
  }, [error]);

  return (
    <MarineFrame>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12"
      >
        <div className="pebl-surface rounded-card p-6 md:p-8 text-center">
          <p className="pebl-eyebrow">The feed hit a snag</p>
          <h1 className="mt-3 font-brand text-h1 text-navy-900">
            We couldn&apos;t load the feed just now.
          </h1>
          <p className="mt-3 text-sm text-navy-900/72">
            {error.digest
              ? `Error ref: ${error.digest}`
              : "Give it another go, this is usually a brief blip."}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button onClick={reset} className="pebl-button-primary px-5 py-3">
              Try again
            </button>
            <Link href="/" className="pebl-button-secondary text-center py-3">
              Back to start
            </Link>
          </div>
        </div>
      </main>
    </MarineFrame>
  );
}
