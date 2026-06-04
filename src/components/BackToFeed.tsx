import Link from "next/link";

/**
 * In-page "Back to feed" affordance for secondary pages (T10 interim). All
 * primary navigation otherwise lives behind the top-left hamburger, which is
 * invisible in an installed PWA and a long reach one-handed; this gives every
 * secondary surface a direct, always-visible return path to the core loop. A
 * persistent bottom tab bar is the fuller fix, tracked as a separate project.
 */
export function BackToFeed({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/feed"
      className={`inline-flex min-h-[44px] w-fit items-center gap-1.5 text-sm font-medium text-teal-700 hover:text-navy-900 ${className}`}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M10 3.5L5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Back to feed
    </Link>
  );
}
