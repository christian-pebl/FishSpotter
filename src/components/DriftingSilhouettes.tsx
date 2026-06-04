"use client";

import { useMemo } from "react";
import { useInView } from "@/lib/useInView";

/**
 * A sparse field of individual marine silhouettes, each drifting gently in its
 * OWN randomly-chosen direction (unlike MarinePattern, a single tiled mask that
 * can only move uniformly). Each silhouette is an absolutely-positioned span
 * tinted via mask-image + `background-color: currentColor`, so the whole field
 * inherits one teal hue from a `text-*` class (colourblind-safe, low cost).
 *
 * The layout is deterministic (seeded PRNG) so the server and client render the
 * same field and there is no hydration mismatch. Decorative -> aria-hidden, and
 * the global prefers-reduced-motion block freezes every drifter.
 */

// Recognisable, UK-marine, non-blob silhouettes (the coiled/ambiguous ones the
// pattern builder also excludes are left out). Mixed from both asset folders.
const SILHOUETTES = [
  "/silhouettes/fish.svg",
  "/silhouettes/flatfish.svg",
  "/silhouettes/crab.svg",
  "/silhouettes/jellyfish.svg",
  "/silhouettes/starfish.svg",
  "/patterns/silhouettes/cuttlefish.svg",
  "/patterns/silhouettes/dolphin.svg",
  "/patterns/silhouettes/eel.svg",
  "/patterns/silhouettes/lobster.svg",
  "/patterns/silhouettes/prawn.svg",
  "/patterns/silhouettes/ray.svg",
  "/patterns/silhouettes/scallop.svg",
  "/patterns/silhouettes/seahorse.svg",
  "/patterns/silhouettes/seal.svg",
  "/patterns/silhouettes/shark.svg",
  "/patterns/silhouettes/shrimp.svg",
  "/patterns/silhouettes/urchin.svg",
  "/patterns/silhouettes/nudibranch.svg",
];

// Deterministic PRNG (mulberry32) -> SSR-stable, reproducible field.
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function DriftingSilhouettes({
  count = 44,
  className = "text-teal-600/[0.12]",
  seed = 7,
}: {
  count?: number;
  /** Tailwind text-colour (+ opacity) the silhouettes inherit. */
  className?: string;
  seed?: number;
}) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const items = useMemo(() => {
    const rand = mulberry32(seed);
    return Array.from({ length: count }, () => {
      const src = SILHOUETTES[Math.floor(rand() * SILHOUETTES.length)];
      const top = rand() * 100;
      const left = rand() * 100;
      const size = 26 + rand() * 38; // 26-64px
      // Each drifter gets its own direction (full 360deg) and travel distance.
      const angle = rand() * Math.PI * 2;
      const dist = 24 + rand() * 34; // px
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const dur = 80 + rand() * 70; // 80-150s -> very slow, calm drift
      const delay = -rand() * dur; // desync so they don't pulse together
      const rot = rand() * 16 - 8; // gentle tilt
      const op = 0.05 + rand() * 0.07; // per-drifter alpha variation
      const mirror = rand() < 0.5 ? -1 : 1;
      return { src, top, left, size, dx, dy, dur, delay, rot, op, mirror };
    });
  }, [count, seed]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className} ${inView ? "" : "fs-paused"}`}
    >
      {items.map((d, i) => (
        <span
          key={i}
          className="fs-drifter absolute block bg-current"
          style={{
            top: `${d.top}%`,
            left: `${d.left}%`,
            width: `${d.size}px`,
            height: `${d.size}px`,
            opacity: d.op,
            WebkitMaskImage: `url(${d.src})`,
            maskImage: `url(${d.src})`,
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            animationDuration: `${d.dur}s`,
            animationDelay: `${d.delay}s`,
            ["--fs-dx" as string]: `${d.dx}px`,
            ["--fs-dy" as string]: `${d.dy}px`,
            ["--fs-rot" as string]: `${d.rot}deg`,
            ["--fs-mir" as string]: `${d.mirror}`,
          }}
        />
      ))}
    </div>
  );
}
