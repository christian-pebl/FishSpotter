"use client";

/**
 * Shared swim loader — a FULL-SCREEN field of marine silhouettes that drift
 * slowly across the viewport and gently bob, at 50% opacity, behind a thin
 * indeterminate progress bar + a rotating caption. Used by EVERY route's
 * Suspense fallback (feed, archive, leaderboard, sign-in) so loading feels
 * consistent and on-brand everywhere, on phone and desktop alike.
 *
 * The creatures are the CC0 shape-class silhouettes from /public/silhouettes
 * (squid, jellyfish, crab, starfish, gastropod — the two bottom-dwelling fish
 * are intentionally left out), tinted teal the same way ShapeGate / MarinePattern
 * do it: `mask-image` + `bg-current`, so the solid SVG becomes a teal silhouette
 * with zero JS cost and they recolour with the text colour.
 *
 * Each drifter softly fades in as it enters and out as it leaves (the opacity
 * ramp in the fs-swimlane keyframe peaks at 0.5), so there are no hard pop-ins
 * at the screen edges — a calm in/out transition.
 *
 * Pure CSS animation (paints on the first frame, no JS needed), so it starts
 * instantly on a cold load. Reduced motion: the CSS animations are neutralised
 * by the global reset in globals.css, and we render an explicit static, spread
 * field (`rest` positions, held at 50% opacity) so opted-out users see a calm,
 * legible frame rather than a frozen off-screen one.
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
  /** Vertical position (spread across the full screen height). */
  top: string;
  /** Width in px (height derives from the natural ratio via `contain`). */
  width: number;
  /** Crossing duration — higher = slower drift across the screen. */
  dur: string;
  /** Negative delay so the field is mid-crossing on the first frame. */
  delay: string;
  /** Left position for the static reduced-motion tableau (spread out). */
  rest: string;
};

// A full-screen field. Durations are deliberately long (20–30s) so the
// creatures drift slowly across rather than darting; `top`/`rest` are spread
// over the whole viewport height so the field fills the screen (moving) and
// reads as a calm, spaced-out scatter when static (reduced motion).
//
// Only water-column / mobile creatures: squid (mantle-first, faces its travel
// direction), jellyfish, crab, starfish, gastropod (head-right). The two
// bottom-dwelling fish were intentionally removed.
const SCHOOL: Swimmer[] = [
  { src: "/silhouettes/squid.svg", top: "6%", width: 64, dur: "24s", delay: "-2s", rest: "8%" },
  { src: "/silhouettes/jellyfish.svg", top: "16%", width: 40, dur: "28s", delay: "-12s", rest: "22%" },
  { src: "/silhouettes/crab.svg", top: "26%", width: 52, dur: "20s", delay: "-6s", rest: "38%" },
  { src: "/silhouettes/starfish.svg", top: "36%", width: 44, dur: "26s", delay: "-17s", rest: "54%" },
  { src: "/silhouettes/gastropod.svg", top: "46%", width: 38, dur: "22s", delay: "-9s", rest: "70%" },
  { src: "/silhouettes/squid.svg", top: "56%", width: 58, dur: "27s", delay: "-20s", rest: "86%" },
  { src: "/silhouettes/jellyfish.svg", top: "66%", width: 36, dur: "25s", delay: "-4s", rest: "14%" },
  { src: "/silhouettes/starfish.svg", top: "76%", width: 48, dur: "21s", delay: "-14s", rest: "30%" },
  { src: "/silhouettes/crab.svg", top: "86%", width: 54, dur: "29s", delay: "-23s", rest: "46%" },
  { src: "/silhouettes/gastropod.svg", top: "92%", width: 40, dur: "23s", delay: "-7s", rest: "62%" },
  { src: "/silhouettes/squid.svg", top: "12%", width: 56, dur: "30s", delay: "-25s", rest: "78%" },
  { src: "/silhouettes/starfish.svg", top: "70%", width: 40, dur: "24s", delay: "-16s", rest: "4%" },
  { src: "/silhouettes/jellyfish.svg", top: "50%", width: 42, dur: "26s", delay: "-11s", rest: "94%" },
];

/** A single masked silhouette — solid SVG tinted teal via mask + currentColor. */
function Silhouette({ src }: { src: string }) {
  const mask: CSSProperties = {
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskSize: "contain",
    maskSize: "contain",
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
      {/* Full-screen ambient field: silhouettes drifting + bobbing across the
          whole viewport at 50% opacity, softly fading in/out at the edges. */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden text-teal-300"
        aria-hidden="true"
      >
        {SCHOOL.map((s, i) => {
          const style: CSSProperties = reduce
            ? { top: s.top, left: s.rest, width: s.width, height: s.width * 0.7, opacity: 0.5 }
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
              <span
                className={reduce ? "block h-full w-full" : "fs-swimwig block h-full w-full"}
                // Desync each creature's bob so the field doesn't pulse in unison.
                style={reduce ? undefined : { animationDelay: `${(-i * 0.9).toFixed(1)}s` }}
              >
                <Silhouette src={s.src} />
              </span>
            </div>
          );
        })}
      </div>

      {/* Indeterminate progress bar + rotating caption, centred over the field. */}
      <div className="relative z-10 w-full max-w-md">
        <div className="relative mx-auto h-1 w-44 overflow-hidden rounded-full bg-teal-300/15">
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
