import Link from "next/link";
import { MarineFrame } from "@/components/MarineFrame";

export default function SnippetNotFound() {
  return (
    <MarineFrame>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12"
      >
        <div className="pebl-surface rounded-card p-6 md:p-8 text-center">
        <p className="pebl-eyebrow">Sighting not found</p>
        <h1 className="mt-3 font-brand text-h1 text-navy-900">
          This sighting may have been retired.
        </h1>
        <p className="mt-3 text-sm text-navy-900/72">
          Snippets occasionally come down for re-encoding or review. The live feed always has the latest catch.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link href="/feed" className="pebl-button-primary text-center px-5 py-3">
            Back to live feed
          </Link>
          <Link href="/feed/browse" className="pebl-button-secondary text-center py-3">
            Browse the archive
          </Link>
        </div>
      </div>
      </main>
    </MarineFrame>
  );
}
