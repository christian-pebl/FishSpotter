"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    // No-ops while SENTRY_DSN is unset (init() is disabled in that case).
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-[100dvh] flex items-center justify-center bg-teal-50 px-4">
        <main
          id="main"
          tabIndex={-1}
          className="w-full max-w-md rounded-card border border-navy-900/12 bg-white p-6 md:p-8 text-center shadow-card"
        >
          <p className="font-bold uppercase tracking-eyebrow text-teal-700 text-xs">
            Critical error
          </p>
          <h1 className="mt-3 font-brand text-h1 text-navy-900">
            FishSpotter ran into a problem it couldn&apos;t recover from.
          </h1>
          <p className="mt-3 text-sm text-navy-900/72">
            {error.digest
              ? `Error ref: ${error.digest}`
              : "Try reloading the page. If it keeps happening, come back later."}
          </p>
          <button
            onClick={reset}
            className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-full bg-teal-500 px-5 font-semibold text-navy-900 transition-colors hover:bg-teal-hover"
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
