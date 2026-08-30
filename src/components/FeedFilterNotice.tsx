"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * "You are watching a filtered feed" pill, shown only when /feed was opened
 * with a filter (the archive's "Launch feed of current filtered videos"
 * button, or a hand-edited URL).
 *
 * It exists because a filtered feed is otherwise indistinguishable from a
 * small one: five hermit-crab clips and a site with five clips look the same
 * from inside the player. It is also the only route back to the whole feed,
 * so it stays put rather than auto-dismissing.
 *
 * Positioned below the /feed header overlay (transparent, absolute top-0,
 * ~3.4rem tall) and narrow enough to clear FeedCard's zoom capsule on the
 * right at top-16. Hidden while a Spot It gate is open, since the gate turns
 * the layout into a split screen and this would then sit over the clip: it
 * listens for the same `fs-gate` event FeedPlayer's nav hint uses.
 */
export function FeedFilterNotice({
  parts,
  clips,
}: {
  /** Human filter summary, e.g. ["Hermit Crab", "Ramsey Sound Farm"]. Empty = unfiltered. */
  parts: string[];
  clips: number;
}) {
  const [gateOpen, setGateOpen] = useState(false);

  useEffect(() => {
    const onGate = (e: Event) => {
      setGateOpen(!!(e as CustomEvent<{ open: boolean }>).detail?.open);
    };
    window.addEventListener("fs-gate", onGate);
    return () => window.removeEventListener("fs-gate", onGate);
  }, []);

  if (parts.length === 0 || gateOpen) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-14"
      style={{ top: "calc(env(safe-area-inset-top) + 3.4rem)" }}
    >
      <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full bg-black/60 py-1 pl-3 pr-1 text-[11px] text-white backdrop-blur-sm">
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="shrink-0 text-teal-300">
          <path
            d="M1.5 2.5h11l-4.2 5v4.2l-2.6 1.3V7.5l-4.2-5z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
        <span className="truncate font-medium">{parts.join(" · ")}</span>
        <span className="shrink-0 text-white/55">
          {clips} clip{clips === 1 ? "" : "s"}
        </span>
        <Link
          href="/feed"
          className="inline-flex shrink-0 items-center rounded-full bg-white/15 px-2.5 py-1 font-semibold transition-colors hover:bg-white/25"
        >
          Show all
        </Link>
      </div>
    </div>
  );
}
