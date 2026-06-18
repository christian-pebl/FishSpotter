"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  motion,
  animate,
  useAnimationControls,
  useReducedMotion,
} from "framer-motion";
import { onPebbles } from "@/lib/pebble-bus";

const overlayTextShadow = "0 1px 3px rgba(0,0,0,0.55)";

// PEBL-stone palette for the flying pebbles. Kept subtle and on-brand.
const PEBBLE_FILLS = ["#3AAFA9", "#2B7A78", "#7fc6c1", "#bfe3e0", "#17252A"];

type FlyingPebble = {
  id: number;
  startX: number;
  startY: number;
  fill: string;
  size: number;
  rotate: number;
};

type Burst = { id: number; pebbles: FlyingPebble[] };

/** A "collect" signal — bump `nonce` to fire a fresh fly-in burst. */
export interface PebbleEarn {
  earned: number;
  firstSighting: boolean;
  nonce: number;
}

/** A single rounded pebble with a soft top highlight. */
function PebbleGlyph({ fill, size }: { fill: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <ellipse cx="8" cy="9" rx="6.5" ry="5" fill={fill} />
      <ellipse cx="6" cy="6.6" rx="2.4" ry="1.4" fill="#ffffff" opacity="0.4" />
    </svg>
  );
}

/** The drawstring pouch the pebbles collect into. */
function Pouch({ onFeed }: { onFeed: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={onFeed ? { filter: `drop-shadow(${overlayTextShadow})` } : undefined}
    >
      {/* pouch body */}
      <path
        d="M5.2 12.4C5.2 9 8.2 7.2 12 7.2s6.8 1.8 6.8 5.2c0 4-2.9 6.6-6.8 6.6s-6.8-2.6-6.8-6.6Z"
        fill="#3AAFA9"
      />
      <path
        d="M5.2 12.4C5.2 9 8.2 7.2 12 7.2s6.8 1.8 6.8 5.2c0 4-2.9 6.6-6.8 6.6s-6.8-2.6-6.8-6.6Z"
        stroke="#2B7A78"
        strokeWidth="1.1"
      />
      {/* drawstring neck */}
      <path
        d="M8.4 7.6c.7-1 2-1.5 3.6-1.5s2.9.5 3.6 1.5"
        stroke="#2B7A78"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M7.4 7.1c1-.7 3-1.1 4.6-1.1s3.6.4 4.6 1.1"
        stroke="#88c5c1"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      {/* two pebbles peeking out of the top */}
      <circle cx="10.4" cy="11.2" r="1.5" fill="#DEF2F1" opacity="0.9" />
      <circle cx="13.4" cy="12" r="1.2" fill="#bfe3e0" opacity="0.85" />
    </svg>
  );
}

/**
 * Presentational pouch with the collect-into-bag animation. Stateless about WHERE
 * Pebbles come from — driven entirely by `total` (animated count-up) and `earn`
 * (a nonce-bumped signal that fires a fly-in burst). Reused by the live container
 * and the Storybook story, so the animation can be watched/tuned in isolation.
 *
 * Smoothness contract: every animated property is transform (x/y/scale/rotate) or
 * opacity — compositor-only, no layout thrash — and the whole thing collapses to a
 * plain count-up under prefers-reduced-motion.
 */
export function PebbleBagView({
  total,
  onFeed,
  earn,
}: {
  total: number;
  onFeed: boolean;
  earn?: PebbleEarn | null;
}) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(total);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const pouchControls = useAnimationControls();
  const displayRef = useRef(total);
  const burstSeq = useRef(0);
  const lastNonce = useRef<number | null>(null);

  // Count-up toward the authoritative total whenever it changes.
  useEffect(() => {
    const from = displayRef.current;
    displayRef.current = total;
    if (reduceMotion || from === total) {
      setDisplay(total);
      return;
    }
    const controls = animate(from, total, {
      duration: 0.6,
      delay: 0.25,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [total, reduceMotion]);

  // Fire a fly-in burst + pouch "plump" when a new earn signal arrives.
  useEffect(() => {
    if (!earn || earn.nonce === lastNonce.current) return;
    lastNonce.current = earn.nonce;
    if (reduceMotion || earn.earned <= 0) return;

    // Keep it subtle: 2 pebbles for a normal sighting, up to 4 for a First
    // Sighting, in a tight spread with gentle rotation.
    const n = Math.min(earn.firstSighting ? 4 : 2, Math.max(1, Math.round(earn.earned / 10)));
    const pebbles: FlyingPebble[] = Array.from({ length: n }, (_, i) => ({
      id: burstSeq.current * 100 + i,
      startX: -9 + Math.random() * 18,
      startY: -22 - Math.random() * 5,
      fill: PEBBLE_FILLS[i % PEBBLE_FILLS.length],
      size: 8 + Math.random() * 2.5,
      rotate: -22 + Math.random() * 44,
    }));
    const burst: Burst = { id: burstSeq.current++, pebbles };
    setBursts((b) => [...b, burst]);
    pouchControls.start({
      scale: [1, 1.1, 1],
      transition: { duration: 0.42, times: [0, 0.45, 1], ease: "easeOut", delay: 0.16 },
    });
    const t = window.setTimeout(
      () => setBursts((b) => b.filter((x) => x.id !== burst.id)),
      1000,
    );
    return () => window.clearTimeout(t);
  }, [earn, reduceMotion, pouchControls]);

  return (
    <span className="relative inline-flex items-center gap-1.5">
      <span className="relative inline-flex">
        <motion.span animate={pouchControls} className="inline-flex">
          <Pouch onFeed={onFeed} />
        </motion.span>
        {/* Fly-in burst layer — absolutely centred over the pouch. */}
        <span className="pointer-events-none absolute left-1/2 top-1/2">
          {bursts.map((burst) =>
            burst.pebbles.map((p, i) => (
              <motion.span
                key={`${burst.id}-${p.id}`}
                className="absolute"
                initial={{ x: p.startX, y: p.startY, opacity: 0, scale: 0.9, rotate: p.rotate }}
                animate={{
                  x: [p.startX, p.startX * 0.3, 0],
                  y: [p.startY, p.startY + 8, 2],
                  opacity: [0, 1, 1, 0],
                  scale: [0.9, 1, 0.25],
                  rotate: p.rotate * 0.4,
                }}
                transition={{ duration: 0.7, delay: i * 0.06, ease: "easeIn", times: [0, 0.5, 1] }}
                style={{ marginLeft: -p.size / 2, marginTop: -p.size / 2 }}
              >
                <PebbleGlyph fill={p.fill} size={p.size} />
              </motion.span>
            )),
          )}
        </span>
      </span>
      <span
        className={`min-w-[1.5ch] text-sm font-semibold tabular-nums ${
          onFeed ? "text-white/90" : "text-teal-700"
        }`}
        style={onFeed ? { textShadow: overlayTextShadow } : undefined}
      >
        {display.toLocaleString()}
      </span>
    </span>
  );
}

/**
 * Live container: pulls the spotter's absolute total on load and listens for
 * Pebble-earn events from the feed (via pebble-bus). Only signed-in spotters get
 * a pouch — guests keep the bare logo.
 */
export function PebbleBag({ onFeed }: { onFeed: boolean }) {
  const { status } = useSession();
  const [total, setTotal] = useState<number | null>(null);
  const [earn, setEarn] = useState<PebbleEarn | null>(null);
  const nonce = useRef(0);

  useEffect(() => {
    if (status !== "authenticated") return;
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
  }, [status]);

  useEffect(() => {
    return onPebbles(({ earned, total: newTotal, firstSighting }) => {
      setTotal(newTotal);
      setEarn({ earned, firstSighting: !!firstSighting, nonce: ++nonce.current });
    });
  }, []);

  const ariaTotal = useCallback(() => (total ?? 0).toLocaleString(), [total]);

  if (status !== "authenticated" || total === null) return null;

  return (
    <Link
      href="/leaderboard"
      aria-label={`Your Pebbles: ${ariaTotal()}. View the leaderboard.`}
      className={`pointer-events-auto inline-flex min-h-[44px] items-center rounded-full px-2 ${
        onFeed ? "hover:bg-white/10" : "hover:bg-[color:var(--surface-muted)]"
      }`}
    >
      <PebbleBagView total={total} onFeed={onFeed} earn={earn} />
    </Link>
  );
}
