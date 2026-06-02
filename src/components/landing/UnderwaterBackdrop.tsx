"use client";

import type { CSSProperties } from "react";
import { useInView } from "@/lib/useInView";

/**
 * Decorative underwater environment for the landing hero: drifting
 * tinted marine silhouettes, slow god-ray light shafts, and rising
 * bubbles. Pure CSS animations, so prefers-reduced-motion (handled
 * globally in globals.css) neutralises all of it; useInView pauses them
 * while the hero is scrolled off-screen.
 *
 * Silhouettes are the CC0 PhyloPic gate assets in /public/silhouettes,
 * tinted to brand teal via mask-image + backgroundColor:currentColor
 * (the same technique as ShapeGate), which keeps them at zero JS cost
 * and lets the alpha ride on the Tailwind text-colour opacity.
 */

type Drifter = {
  shape: string;
  top: string;
  width: number;
  duration: string;
  delay: string;
  rotate: string;
  opacity: string;
};

// Kept to 4 drifters (down from 6) to reduce always-on composited layers
// on mid-range mobile, where blurred mask-image transforms are expensive.
// Opacities raised from the original 7-10% (which read as barely-there grey)
// so the silhouettes are legible as marine life while staying decorative.
// Silhouettes face right, i.e. head-first into the left-to-right drift.
const DRIFTERS: Drifter[] = [
  { shape: "fish",     top: "16%", width: 190, duration: "46s", delay: "-4s",  rotate: "-4deg", opacity: "text-teal-700/[0.18]" },
  { shape: "squid",    top: "38%", width: 110, duration: "64s", delay: "-12s", rotate: "8deg",  opacity: "text-teal-600/[0.16]" },
  { shape: "jellyfish",top: "72%", width: 90,  duration: "52s", delay: "-30s", rotate: "0deg",  opacity: "text-teal-600/[0.14]" },
  { shape: "starfish", top: "28%", width: 76,  duration: "76s", delay: "-40s", rotate: "0deg",  opacity: "text-teal-600/[0.13]" },
];

function maskStyle(shape: string): CSSProperties {
  const url = `url(/silhouettes/${shape}.svg)`;
  return {
    WebkitMaskImage: url,
    maskImage: url,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
    maskSize: "contain",
    backgroundColor: "currentColor",
  };
}

export function UnderwaterBackdrop() {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden rounded-card ${inView ? "" : "fs-paused"}`}
    >
      {/* Depth gradient: bright at the surface, deepening into teal. */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-teal-50/30 to-teal-600/15" />

      {/* God-ray light shafts. */}
      <div
        className="fs-shaft absolute -top-1/4 left-[12%] h-[150%] w-24 -rotate-12 bg-gradient-to-b from-white/50 to-transparent blur-sm"
        style={{ animationDuration: "9s" }}
      />
      <div
        className="fs-shaft absolute -top-1/4 left-[46%] h-[150%] w-16 -rotate-12 bg-gradient-to-b from-white/40 to-transparent blur-sm"
        style={{ animationDuration: "11s", animationDelay: "-3s" }}
      />
      <div
        className="fs-shaft absolute -top-1/4 right-[18%] h-[150%] w-20 -rotate-12 bg-gradient-to-b from-white/45 to-transparent blur-sm"
        style={{ animationDuration: "13s", animationDelay: "-6s" }}
      />

      {/* Drifting silhouettes. */}
      {DRIFTERS.map((d, i) => (
        <div
          key={i}
          className={`fs-drift absolute ${d.opacity}`}
          style={{
            top: d.top,
            width: d.width,
            height: d.width * 0.4,
            animationDuration: d.duration,
            animationDelay: d.delay,
            ["--fs-rot" as string]: d.rotate,
            ...maskStyle(d.shape),
          }}
        />
      ))}

      {/* Rising bubbles. */}
      {[
        { left: "20%", size: 8, dur: "8s", delay: "0s", bottom: "8%" },
        { left: "34%", size: 5, dur: "10s", delay: "-3s", bottom: "14%" },
        { left: "58%", size: 10, dur: "9s", delay: "-5s", bottom: "6%" },
        { left: "73%", size: 6, dur: "11s", delay: "-1.5s", bottom: "12%" },
        { left: "88%", size: 7, dur: "12s", delay: "-7s", bottom: "10%" },
      ].map((b, i) => (
        <span
          key={i}
          className="fs-bubble absolute rounded-full bg-white/40 ring-1 ring-white/30"
          style={{
            left: b.left,
            bottom: b.bottom,
            width: b.size,
            height: b.size,
            animationDuration: b.dur,
            animationDelay: b.delay,
          }}
        />
      ))}
    </div>
  );
}
