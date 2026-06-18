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

export function PebbleBag({ onFeed }: { onFeed: boolean }) {
  const { status } = useSession();
  const reduceMotion = useReducedMotion();
  const [total, setTotal] = useState<number | null>(null);
  const [display, setDisplay] = useState(0);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const pouchControls = useAnimationControls();
  const totalRef = useRef(0);
  const burstSeq = useRef(0);

  // Load the absolute total once the session is known.
  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    fetch("/api/me/pebbles")
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        const t = Number(d.total ?? 0);
        totalRef.current = t;
        setTotal(t);
        setDisplay(t);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [status]);

  const spawnBurst = useCallback(
    (earned: number, firstSighting: boolean) => {
      if (reduceMotion || earned <= 0) return;
      const n = Math.min(firstSighting ? 6 : 4, Math.max(1, Math.round(earned / 6)));
      const pebbles: FlyingPebble[] = Array.from({ length: n }, (_, i) => ({
        id: burstSeq.current * 100 + i,
        startX: -14 + Math.random() * 28,
        startY: -26 - Math.random() * 8,
        fill: PEBBLE_FILLS[i % PEBBLE_FILLS.length],
        size: 9 + Math.random() * 4,
        rotate: -40 + Math.random() * 80,
      }));
      const burst: Burst = { id: burstSeq.current++, pebbles };
      setBursts((b) => [...b, burst]);
      // Pouch "plump" when the pebbles land.
      pouchControls.start({
        scale: [1, 1.18, 1],
        transition: { duration: 0.4, times: [0, 0.45, 1], ease: "easeOut", delay: 0.18 },
      });
      // Clean up the burst once its pebbles have settled.
      window.setTimeout(() => {
        setBursts((b) => b.filter((x) => x.id !== burst.id));
      }, 1000);
    },
    [reduceMotion, pouchControls],
  );

  useEffect(() => {
    return onPebbles(({ earned, total: newTotal, firstSighting }) => {
      const from = totalRef.current;
      totalRef.current = newTotal;
      setTotal(newTotal);
      spawnBurst(earned, !!firstSighting);
      if (reduceMotion) {
        setDisplay(newTotal);
        return;
      }
      // Count-up, started slightly after the pebbles begin to drop.
      animate(from, newTotal, {
        duration: 0.6,
        delay: 0.25,
        ease: "easeOut",
        onUpdate: (v) => setDisplay(Math.round(v)),
      });
    });
  }, [spawnBurst, reduceMotion]);

  // Only signed-in spotters have a pouch (guests keep the bare logo).
  if (status !== "authenticated" || total === null) return null;

  return (
    <Link
      href="/leaderboard"
      aria-label={`Your Pebbles: ${total.toLocaleString()}. View the leaderboard.`}
      className={`pointer-events-auto relative inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-2 ${
        onFeed ? "hover:bg-white/10" : "hover:bg-[color:var(--surface-muted)]"
      }`}
    >
      <span className="relative inline-flex">
        <motion.span animate={pouchControls} className="inline-flex">
          <Pouch onFeed={onFeed} />
        </motion.span>
        {/* Fly-in burst layer — absolutely centred over the pouch. */}
        <span className="pointer-events-none absolute left-1/2 top-1/2 -z-0">
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
                transition={{
                  duration: 0.7,
                  delay: i * 0.06,
                  ease: "easeIn",
                  times: [0, 0.5, 1],
                }}
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
    </Link>
  );
}
