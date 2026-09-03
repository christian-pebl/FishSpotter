"use client";

import { useEffect, useRef, useState } from "react";

type ShareState = "idle" | "shared" | "copied" | "manual";

export type ShareSelectionButtonProps = {
  /**
   * Site-relative address of the selection, e.g. "/feed/browse?site=Skye". Made
   * absolute at click time against the page's own origin, so a preview
   * deployment shares itself and production shares production.
   */
  path: string;
  /** Share-sheet title, e.g. "Clips from Dale Bay on FishSpotter". */
  title: string;
  /** Share-sheet body, one line. */
  text: string;
};

/**
 * Hands a selection to someone else.
 *
 * On a touch device it opens the native share sheet, which is where a phone
 * user expects a link to go (Messages, WhatsApp, and so on). Everywhere else it
 * copies the link, because on a desktop the share sheet is a detour and the
 * clipboard is what people actually reach for. If the clipboard is refused (an
 * insecure context, a denied permission) the link is shown in a box the reader
 * can copy by hand, so the button never silently does nothing.
 */
export function ShareSelectionButton({ path, title, text }: ShareSelectionButtonProps) {
  const [state, setState] = useState<ShareState>("idle");
  const [url, setUrl] = useState("");
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  function settle(next: ShareState) {
    setState(next);
    resetTimer.current = window.setTimeout(() => setState("idle"), 2500);
  }

  async function share() {
    const absolute = new URL(path, window.location.origin).toString();
    setUrl(absolute);
    window.clearTimeout(resetTimer.current);

    if (prefersShareSheet() && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url: absolute });
        settle("shared");
        return;
      } catch (err) {
        // The reader closed the sheet: nothing to report, nothing to fall back to.
        if (err instanceof Error && err.name === "AbortError") return;
        // Any other failure falls through to the clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(absolute);
      settle("copied");
    } catch {
      setState("manual");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={share}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-semibold text-navy-900 transition-colors hover:bg-white"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-teal-700">
          <path
            d="M8 2v8M5 4.5L8 1.5l3 3M3.5 8v4.5a1 1 0 001 1h7a1 1 0 001-1V8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Share this selection
      </button>
      <span role="status" aria-live="polite" className="text-xs text-navy-900/55">
        {state === "copied" ? "Link copied" : state === "shared" ? "Shared" : ""}
      </span>
      {state === "manual" && (
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Link to this selection"
          className="min-h-[44px] w-full max-w-md rounded-modal bg-white/70 px-3 text-xs text-navy-900"
        />
      )}
    </div>
  );
}

/** A touch-first device, where the native share sheet is the expected route. */
function prefersShareSheet(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
}
