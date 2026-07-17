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
 * The layout is deterministic (seeded PRNG) so the server and client agree on
 * every value, EXCEPT that Math.cos/Math.sin aren't spec-guaranteed
 * bit-identical across engines — round() below normalises that away before
 * the numbers get stringified into `style`, so there is no hydration
 * mismatch. Decorative -> aria-hidden, and the global prefers-reduced-motion
 * block freezes every drifter.
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

// Math.cos/Math.sin (used below for dx/dy) aren't guaranteed bit-identical
// across JS engines for the same input — Node's SSR and the browser's
// hydration pass can differ in the last float bit. React's hydration check
// compares the stringified style attribute, so an unrounded value like
// -4.930483214042849 vs ...48 trips a mismatch warning on every page load.
// Rounding to a fixed, coarse precision before formatting makes the two
// strings match regardless of that last-bit float noise; the precision is
// far finer than perceptible on a slow decorative drift anyway.
function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
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
      const top = round(rand() * 100, 2);
      const left = round(rand() * 100, 2);
      const size = round(26 + rand() * 38, 1); // 26-64px
      // Each drifter gets its own direction (full 360deg) and travel distance.
      const angle = rand() * Math.PI * 2;
      const dist = 24 + rand() * 34; // px
      const dx = round(Math.cos(angle) * dist, 2);
      const dy = round(Math.sin(angle) * dist, 2);
      const dur = round(80 + rand() * 70, 2); // 80-150s -> very slow, calm drift
      const delay = round(-rand() * dur, 2); // desync so they don't pulse together
      const rot = round(rand() * 16 - 8, 2); // gentle tilt
      const op = round(0.05 + rand() * 0.07, 3); // per-drifter alpha variation
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
