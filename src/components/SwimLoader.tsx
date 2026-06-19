"use client";

/**
 * Shared swim loader — a school of varied marine silhouettes drifting across a
 * navy screen above a thin indeterminate progress bar. Used by EVERY route's
 * Suspense fallback (feed, archive, leaderboard, sign-in) so loading feels
 * consistent and on-brand everywhere, not just on the cold app boot.
 *
 * The creatures are the real CC0 shape-class silhouettes from
 * /public/silhouettes (fish, squid, jellyfish, crab, starfish, flatfish,
 * gastropod), tinted teal the same way ShapeGate / MarinePattern do it:
 * `mask-image` + `bg-current`, so the solid SVG becomes a teal silhouette with
 * zero JS cost and they recolour with the text colour.
 *
 * Pure CSS animation (paints on the first frame, no JS needed), so it starts
 * instantly on a cold load. Reduced motion: the CSS animations are neutralised
 * by the global reset in globals.css, and we render an explicit static, spread
 * school (`rest` positions) so opted-out users see a calm, legible frame rather
 * than a frozen off-screen one.
 */

import { type CSSProperties, useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

// A pool of short, on-brand eyebrow phrases. The loader rotates through these
// on every mount (cold boot AND soft navigations like archive → live feed) so
// the wait reads fresh each time rather than repeating one fixed line.
const CAPTIONS = [
  "Spotting the reef",
  "Scanning the shallows",
  "Chasing the shoal",
  "Following the current",
  "Drifting through the kelp",
  "Tracking the tide",
  "Combing the seabed",
  "Watching the water",
  "Counting the fins",
  "Surfacing the clips",
] as const;

type Swimmer = {
  /** Public path to the silhouette SVG (used as a CSS mask). */
  src: string;
  /** Vertical lane position. */
  top: string;
  /** Width in px (height derives from the natural ratio via `contain`). */
  width: number;
  /** Crossing duration — higher = slower drift across the screen. */
  dur: string;
  /** Negative delay so the school is mid-crossing on the first frame. */
  delay: string;
  /** Left position for the static reduced-motion tableau (spread out). */
  rest: string;
  /** Mirror horizontally so the creature faces its direction of travel. */
  flip?: boolean;
};

// A varied school. Durations are deliberately long (8–13s) so the creatures
// drift slowly across rather than darting. `top`/`rest` are spread so the
// moving school fills the lane and the static (reduced-motion) school reads as
// a calm spaced-out row.
//
// The lane travels left → right (see `fs-swimlane`), so every directional
// creature must point right. `fish` + `flatfish` art faces left natively, so
// they carry `flip` to face their direction of travel; the squid (mantle-first)
// and gastropod (head right) already lead correctly, and the jellyfish / crab /
// starfish are radial so they need no flip.
const SCHOOL: Swimmer[] = [
  { src: "/silhouettes/fish.svg", top: "16%", width: 78, dur: "9s", delay: "0s", rest: "8%", flip: true },
  { src: "/silhouettes/squid.svg", top: "60%", width: 66, dur: "12s", delay: "-3s", rest: "26%" },
  { src: "/silhouettes/jellyfish.svg", top: "34%", width: 42, dur: "13s", delay: "-7.5s", rest: "44%" },
  { src: "/silhouettes/crab.svg", top: "72%", width: 54, dur: "10.5s", delay: "-5s", rest: "60%" },
  { src: "/silhouettes/starfish.svg", top: "10%", width: 46, dur: "12s", delay: "-9s", rest: "76%" },
  { src: "/silhouettes/flatfish.svg", top: "48%", width: 72, dur: "8s", delay: "-1.5s", rest: "90%", flip: true },
  { src: "/silhouettes/gastropod.svg", top: "82%", width: 40, dur: "12.5s", delay: "-6s", rest: "18%" },
];

/** A single masked silhouette — solid SVG tinted teal via mask + currentColor. */
function Silhouette({ src, flip }: { src: string; flip?: boolean }) {
  const mask: CSSProperties = {
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskSize: "contain",
    maskSize: "contain",
    transform: flip ? "scaleX(-1)" : undefined,
  };
  return <span aria-hidden="true" className="block h-full w-full bg-current" style={mask} />;
}

export function SwimLoader({
  caption,
  label = "Loading",
}: {
  /** Deterministic first-paint eyebrow (avoids a hydration mismatch); the
   *  component then rotates to a random phrase from CAPTIONS on mount. */
  caption: string;
  /** Accessible label for the busy region. */
  label?: string;
}) {
  const reduce = useReducedMotion();

  // Seed with the passed `caption` for SSR/first paint (stable across the
  // server↔client boundary), then swap to a fresh random phrase once mounted so
  // every load — and every soft navigation — shows a different line.
  const [phrase, setPhrase] = useState(caption);
  useEffect(() => {
    setPhrase(CAPTIONS[Math.floor(Math.random() * CAPTIONS.length)]);
  }, []);

  return (
    <main
      id="main"
      tabIndex={-1}
      className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-navy-900 px-6"
      aria-busy="true"
      aria-label={label}
    >
      <div className="relative w-full max-w-md">
        {/* swim lane */}
        <div className="relative h-48 w-full text-teal-300 sm:h-56" aria-hidden="true">
          {SCHOOL.map((s, i) => {
            const style: CSSProperties = reduce
              ? { top: s.top, left: s.rest, width: s.width, height: s.width * 0.7 }
              : {
                  top: s.top,
                  width: s.width,
                  height: s.width * 0.7,
                  animationDuration: s.dur,
                  animationDelay: s.delay,
                };
            return (
              <div
                key={i}
                className={reduce ? "absolute" : "fs-swimlane absolute left-0"}
                style={style}
              >
                <span className={reduce ? "block h-full w-full" : "fs-swimwig block h-full w-full"}>
                  <Silhouette src={s.src} flip={s.flip} />
                </span>
              </div>
            );
          })}
        </div>

        {/* indeterminate progress bar (the loading-bar cue) */}
        <div className="relative mx-auto mt-2 h-1 w-44 overflow-hidden rounded-full bg-teal-300/15">
          {reduce ? (
            <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-teal-400" />
          ) : (
            <div className="fs-loadbar absolute inset-y-0 w-1/3 rounded-full bg-teal-400" />
          )}
        </div>

        <p className="pebl-eyebrow mt-4 text-center text-teal-200/90">{phrase}</p>
      </div>
    </main>
  );
}
