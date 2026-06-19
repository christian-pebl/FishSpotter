"use client";

/**
 * Shared swim loader — a FULL-SCREEN field of marine silhouettes that drift
 * slowly across the viewport and gently bob, at 50% opacity, behind a thin
 * indeterminate progress bar + a rotating caption. Used by EVERY route's
 * Suspense fallback (feed, archive, leaderboard, sign-in) so loading feels
 * consistent and on-brand everywhere, on phone and desktop alike.
 *
 * The creatures are the CC0 silhouettes drawn from EVERY rung's asset folder —
 * the rung-1 shape-class gate (/silhouettes), the rung-2/3 body forms
 * (/silhouettes/forms) and the decorative marine set (/patterns/silhouettes) —
 * deduped to one source per concept for a wide, varied cast. The two
 * bottom-dwelling fish (the catfish-like `fish`/`flatfish` gate art and the
 * bottom-* forms) are intentionally left out. Each is tinted teal the same way
 * ShapeGate / MarinePattern do it: `mask-image` + `bg-current`.
 *
 * Layout (no overlap): the field is split into horizontal LANES. Vertically,
 * lanes don't share space, so creatures in different lanes never collide. Each
 * lane carries two creatures that share ONE drift duration and sit half a period
 * apart (opposite sides of the screen), so they never collide within the lane
 * either. Sizes are small so many fit; each one softly fades in as it enters and
 * out as it leaves (the opacity ramp in the fs-swimlane keyframe peaks at 0.5),
 * so there are no hard pop-ins at the edges.
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

// A diverse cast pulled from every rung's silhouette folder, interleaved so that
// consecutive entries (which land in adjacent lanes) look different. Deduped to
// one source per concept (e.g. squid from the gate, octopus/cuttlefish/shark
// from the pattern set). Bottom-dwelling fish are deliberately excluded.
const POOL = [
  "/silhouettes/squid.svg", // rung-1 shape-class gate
  "/silhouettes/forms/cod-like.svg", // rung-2/3 body forms
  "/patterns/silhouettes/seahorse.svg", // decorative marine set
  "/silhouettes/crab.svg",
  "/silhouettes/forms/wrasse.svg",
  "/patterns/silhouettes/ray.svg",
  "/silhouettes/jellyfish.svg",
  "/silhouettes/forms/silver-shoaler.svg",
  "/patterns/silhouettes/shark.svg",
  "/silhouettes/starfish.svg",
  "/silhouettes/forms/long-skinny.svg",
  "/patterns/silhouettes/dolphin.svg",
  "/silhouettes/gastropod.svg",
  "/silhouettes/forms/eel-like.svg",
  "/patterns/silhouettes/turtle.svg",
  "/silhouettes/forms/elongated.svg",
  "/patterns/silhouettes/seal.svg",
  "/silhouettes/forms/fusiform.svg",
  "/patterns/silhouettes/octopus.svg",
  "/silhouettes/forms/swimming.svg",
  "/patterns/silhouettes/cuttlefish.svg",
  "/silhouettes/forms/thin-whippy.svg",
  "/patterns/silhouettes/lobster.svg",
  "/silhouettes/forms/bobtail.svg",
  "/patterns/silhouettes/prawn.svg",
  "/silhouettes/forms/spider.svg",
  "/patterns/silhouettes/shrimp.svg",
  "/silhouettes/forms/hermit.svg",
  "/patterns/silhouettes/nudibranch.svg",
  "/silhouettes/forms/broad-carapace.svg",
  "/patterns/silhouettes/scallop.svg",
  "/silhouettes/forms/rounded-squat.svg",
  "/patterns/silhouettes/mussel.svg",
  "/silhouettes/forms/long-smooth.svg",
  "/patterns/silhouettes/urchin.svg",
  "/silhouettes/forms/frilly-arms.svg",
  "/patterns/silhouettes/anemone.svg",
  "/silhouettes/forms/long-spiny.svg",
] as const;

type Swimmer = {
  /** Public path to the silhouette SVG (used as a CSS mask). */
  src: string;
  /** CSS top — the lane centre, offset up by half the creature height so it
   *  sits centred on the lane line regardless of the px height. */
  top: string;
  /** Width / height in px (small, so many fit). */
  width: number;
  height: number;
  /** Crossing duration — shared by both creatures in a lane (keeps them a fixed
   *  distance apart so they never overlap). */
  dur: string;
  /** Negative delay; the second creature in a lane trails by half a period. */
  delay: string;
  /** Left position for the static reduced-motion tableau (spread out). */
  rest: string;
};

// Build a non-overlapping field: LANES horizontal bands, PER_LANE creatures per
// lane spread evenly around the crossing (so they're always 1/PER_LANE of a
// period — i.e. a large slice of the screen — apart, never overlapping). Lanes
// are phase-staggered by the golden ratio so the cast stays evenly spread across
// the width at every moment, not bunched. Deterministic (no Math.random) so SSR
// and the client render the identical field — no hydration mismatch.
const LANES = 16;
const PER_LANE = 3;
const REST_LEFT = [12, 42, 72]; // static reduced-motion columns, per PER_LANE

function buildSchool(): Swimmer[] {
  const out: Swimmer[] = [];
  for (let lane = 0; lane < LANES; lane++) {
    const centre = ((lane + 0.5) / LANES) * 100; // % down the screen
    const dur = 24 + (lane % 6) * 2; // 24–34s, slow drift
    const lanePhase = (lane * 0.618) % 1; // golden-ratio stagger across lanes
    for (let j = 0; j < PER_LANE; j++) {
      const idx = lane * PER_LANE + j;
      const width = 20 + (idx % 7) * 2; // 20–32px (small)
      const height = Math.round(width * 0.7);
      const phaseFrac = (lanePhase + j / PER_LANE) % 1; // evenly spaced in-lane
      out.push({
        src: POOL[idx % POOL.length],
        top: `calc(${centre.toFixed(2)}% - ${(height / 2).toFixed(1)}px)`,
        width,
        height,
        dur: `${dur}s`,
        delay: `${(-phaseFrac * dur).toFixed(2)}s`,
        rest: `${REST_LEFT[j] + (lane % 4) * 5}%`,
      });
    }
  }
  return out;
}

const SCHOOL = buildSchool();

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
      {/* Full-screen ambient field: a diverse, non-overlapping cast drifting +
          bobbing across the whole viewport at 50% opacity, softly fading at the
          edges. */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden text-teal-300"
        aria-hidden="true"
      >
        {SCHOOL.map((s, k) => {
          const style: CSSProperties = reduce
            ? { top: s.top, left: s.rest, width: s.width, height: s.height, opacity: 0.5 }
            : {
                top: s.top,
                width: s.width,
                height: s.height,
                animationDuration: s.dur,
                animationDelay: s.delay,
              };
          return (
            <div
              key={k}
              className={reduce ? "absolute" : "fs-swimlane absolute left-0"}
              style={style}
            >
              <span
                className={reduce ? "block h-full w-full" : "fs-swimwig block h-full w-full"}
                // Desync each creature's bob so the field doesn't pulse in unison.
                style={reduce ? undefined : { animationDelay: `${(-k * 0.6).toFixed(1)}s` }}
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
