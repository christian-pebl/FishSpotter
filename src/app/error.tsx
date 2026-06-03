"use client";

import Link from "next/link";
import { useEffect } from "react";
import { MarineFrame } from "@/components/MarineFrame";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <MarineFrame>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12"
      >
        <div className="pebl-surface rounded-card p-6 md:p-8 text-center">
        <p className="pebl-eyebrow">Something went wrong</p>
        <h1 className="mt-3 font-brand text-h1 text-navy-900">
          We hit a snag loading this page.
        </h1>
        <p className="mt-3 text-sm text-navy-900/72">
          {error.digest
            ? `Error ref: ${error.digest}`
            : "If this keeps happening, try refreshing or coming back later."}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button onClick={reset} className="pebl-button-primary px-5 py-3">
            Try again
          </button>
          <Link
            href="/feed"
            className="pebl-button-secondary text-center py-3"
          >
            Back to live feed
          </Link>
        </div>
      </div>
      </main>
    </MarineFrame>
  );
}
