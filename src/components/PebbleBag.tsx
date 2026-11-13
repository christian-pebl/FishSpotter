"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { PebbleEarn } from "@/components/PebbleBagView";
import { useLazyComponent } from "@/lib/useLazyComponent";
import { onPebbles } from "@/lib/pebble-bus";

// The animated pouch lives in its own file and is fetched on demand. See
// PebbleBagView.tsx for why.
const loadPebbleBagView = () =>
  import("@/components/PebbleBagView").then((m) => m.PebbleBagView);

/**
 * Live container: pulls the spotter's lifetime EARNED Pebbles on load (the
 * shop is retired, so there is no spend and one number rules everything: the
 * bag, the leaderboard rank, and the prize progress) and keeps it in sync as
 * earning events arrive via the pebble bus. Only signed-in spotters get a
 * pouch; guests keep the bare logo.
 */
export function PebbleBag({ onFeed }: { onFeed: boolean }) {
  const { status } = useSession();
  const [total, setTotal] = useState<number | null>(null);
  const [earn, setEarn] = useState<PebbleEarn | null>(null);
  const [PebbleBagView, requestView] = useLazyComponent(loadPebbleBagView);
  const nonce = useRef(0);

  useEffect(() => {
    if (status !== "authenticated") return;
    // Start fetching the pouch's code now, beside the total below, so the two
    // arrive together. A guest never gets here, so never downloads it.
    requestView();
    let active = true;
    fetch("/api/me/pebbles")
      .then((r) => r.json())
      .then((d) => {
        if (active) setTotal(Number(d.total ?? 0));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [status, requestView]);

  useEffect(
    () =>
      onPebbles(({ earned, firstSighting, total: newTotal }) => {
        // Adopt the authoritative lifetime total from the earn event when it
        // carries one; otherwise add the delta.
        setTotal((t) => (newTotal > 0 ? newTotal : (t ?? 0) + earned));
        setEarn({ earned, firstSighting: !!firstSighting, nonce: ++nonce.current });
      }),
    [],
  );

  const ariaTotal = useCallback(() => (total ?? 0).toLocaleString(), [total]);

  // Nothing until there is a number AND the pouch to show it in, so the link
  // never appears as an empty pill.
  if (status !== "authenticated" || total === null || PebbleBagView === null) return null;

  return (
    <Link
      href="/pebbles"
      // First-run tour anchor: the pebbles hint tethers itself under the bag.
      data-tour="pebbles"
      aria-label={`Your Pebbles: ${ariaTotal()}. See the leaderboard and your prize progress.`}
      className={`pointer-events-auto inline-flex min-h-[44px] items-center rounded-full px-2 ${
        onFeed ? "hover:bg-white/10" : "hover:bg-[color:var(--surface-muted)]"
      }`}
    >
      <PebbleBagView total={total} onFeed={onFeed} earn={earn} />
    </Link>
  );
}
