import Link from "next/link";
import { MarineFrame } from "@/components/MarineFrame";

export default function NotFound() {
  return (
    <MarineFrame>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12"
      >
        <div className="pebl-surface rounded-card p-6 md:p-8 text-center">
        <p className="pebl-eyebrow">404</p>
        <h1 className="mt-3 font-brand text-h1 text-navy-900">
          Page not found.
        </h1>
        <p className="mt-3 text-sm text-navy-900/72">
          The page you&apos;re looking for isn&apos;t here. Try the live feed or the archive instead.
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
