"use client";

/**
 * Shared swim loader — a FULL-SCREEN field of marine silhouettes that drift
 * slowly across the viewport and gently bob, behind a thin progress bar + a
 * rotating caption. Used by EVERY route's Suspense fallback (feed, archive,
 * leaderboard, sign-in) so loading feels consistent and on-brand everywhere,
 * on phone and desktop alike.
 *
 * The whole field is wrapped in a master fade ENVELOPE (fs-swimfield): the
 * screen opens on the bare background, the cast fades up, holds while it drifts,
 * then fades back out as the progress fill reaches its end — one slick arc that
 * dissolves into the page being loaded. It loops (synced to the fill) so a slow
 * load simply repeats the breath rather than stranding an empty screen.
 *
 * The creatures are the CC0 silhouettes drawn from EVERY rung's asset folder —
 * the rung-1 shape-class gate (/silhouettes), the rung-2/3 body forms
 * (/silhouettes/forms) and the decorative marine set (/patterns/silhouettes) —
 * deduped to one source per concept for a wide, varied cast. The two
 * bottom-dwelling fish (the catfish-like `fish`/`flatfish` gate art and the
 * bottom-* forms) are intentionally left out. Each is tinted teal the same way
 * ShapeGate / MarinePattern do it: `mask-image` + `bg-current`.
 *
 * Layout: horizontal LANES are used only as a STRATIFIED-SAMPLING device — they
 * guarantee the cast covers the full height — but each creature is then jittered
 * almost a full lane off its band, so the field reads random rather than ruled.
 * Sizes are small so occasional overlap at 50% opacity is harmless and natural;
 * each one softly fades in as it enters and out as it leaves (the opacity ramp
 * in the fs-swimlane keyframe peaks at 0.5), so there are no hard pop-ins.
 *
 * Movement reads like loose, drifting CURRENTS — everything travels broadly
 * left→right, but each creature is scattered to a stratified-random spot (not a
 * tidy grid), starts at a fully-random point in its crossing (so there are no
 * even columns at any instant), runs at its own speed, and follows a CURVED
 * path: a pronounced, varied net vertical angle plus a mid-crossing waypoint
 * pulled off the straight chord, so it bows and meanders like an eddy rather
 * than sliding along a ruler line. The result fans the cast out in slightly
 * different directions instead of a parallel parade.
 *
 * Pure CSS animation (paints on the first frame, no JS needed), so it starts
 * instantly on a cold load. Reduced motion: the CSS animations are neutralised
 * by the global reset in globals.css, and we render an explicit static, spread
 * field (`rest` positions, held at 50% opacity) so opted-out users see a calm,
 * legible frame rather than a frozen off-screen one.
 */

import { type CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";

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
  /** CSS top — the (jittered) lane centre, offset up by half the creature
   *  height so it sits on its line regardless of the px height. */
  top: string;
  /** Width / height in px (small, so many fit). */
  width: number;
  height: number;
  /** Crossing duration — per-creature, so everything drifts at its own speed. */
  dur: string;
  /** Negative delay so the field is mid-crossing on the first frame. */
  delay: string;
  /** Net vertical drift over one crossing (vh) — each creature's own left→right
   *  angle, varied enough that the cast fans out instead of running parallel. */
  dy: string;
  /** Mid-crossing vertical waypoint (vh), pulled off the straight chord so the
   *  path bows into a curve and meanders like a current. */
  dyMid: string;
  /** Per-creature bob duration, so the wig doesn't beat in unison. */
  wigDur: string;
  /** Left position for the static reduced-motion tableau (spread out). */
  rest: string;
};

// Build the field: LANES horizontal bands are a stratified-sampling device (they
// guarantee full-height coverage), but every creature is then heavily jittered
// off its band, given a FULLY random crossing phase, its own speed, a pronounced
// varied vertical angle, and a curved path — so the cast scatters and meanders
// like loose currents rather than marching in a grid. Still all slow and broadly
// left→right. Deterministic (a fixed hash, no Math.random) so SSR and the client
// render the identical field — no hydration mismatch.
const LANES = 18;
const PER_LANE = 3;
const REST_LEFT = [12, 42, 72]; // static reduced-motion columns, per PER_LANE

// Stable pseudo-random in [0,1) from an integer — identical on server + client.
// Two decorrelated draws per seed (different multipliers) so axes don't align.
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function buildSchool(): Swimmer[] {
  const laneH = 100 / LANES;
  const out: Swimmer[] = [];
  for (let lane = 0; lane < LANES; lane++) {
    for (let j = 0; j < PER_LANE; j++) {
      const idx = lane * PER_LANE + j;
      const hSpeed = hash(idx + 1);
      const hPhase = hash(idx + 101);
      const hTop = hash(idx + 211);
      const hAngle = hash(idx + 307);
      const hSize = hash(idx + 409);
      const hMid = hash(idx + 521);
      const hWig = hash(idx + 631);

      const width = 18 + Math.round(hSize * 18); // 18–36px — a wider size spread
      const height = Math.round(width * 0.7);
      // Stratified-random vertical: the lane is a coarse band, but a near-full-
      // lane jitter (±0.95·laneH) scatters the creature so the field reads random
      // rather than ruled, while still covering the whole height.
      const centre = ((lane + 0.5) / LANES) * 100 + (hTop - 0.5) * laneH * 1.9;
      const dur = 22 + hSpeed * 26; // 22–48s — a wide speed spread
      // FULLY random crossing phase → no even columns lined up at any instant.
      const phaseFrac = hPhase;
      // Net vertical travel across the crossing: a pronounced, varied angle so
      // creatures fan out in slightly different directions, not dead-flat parallel.
      const dy = (hAngle * 2 - 1) * 13; // −13…+13vh
      // Midpoint waypoint pulled off the straight chord → the path bows/meanders
      // like an eddying current instead of a straight diagonal.
      const dyMid = dy * 0.5 + (hMid - 0.5) * 16; // ±8vh of curve off the chord

      out.push({
        src: POOL[idx % POOL.length],
        top: `calc(${centre.toFixed(2)}% - ${(height / 2).toFixed(1)}px)`,
        width,
        height,
        dur: `${dur.toFixed(1)}s`,
        delay: `${(-phaseFrac * dur).toFixed(2)}s`,
        dy: `${dy.toFixed(2)}vh`,
        dyMid: `${dyMid.toFixed(2)}vh`,
        wigDur: `${(4.5 + hWig * 3.5).toFixed(1)}s`, // 4.5–8s per-creature bob
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
  label = "Loading",
}: {
  /** Accessible label for the busy region. */
  label?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <main
      id="main"
      tabIndex={-1}
      className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-navy-900 px-6"
      aria-busy="true"
      aria-label={label}
    >
      {/* Full-screen ambient field: a diverse cast drifting + bobbing across the
          whole viewport. A master envelope (fs-swimfield) opens on the bare
          background, fades the whole cast up, holds it while it drifts, then
          fades it back out in sync with the loadbar fill — one slick arc that
          dissolves into the page. The per-creature drift/bob run underneath. */}
      <div
        className={`pointer-events-none absolute inset-0 overflow-hidden text-teal-300 ${
          reduce ? "" : "fs-swimfield"
        }`}
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
                // Per-creature curved drift: its own net angle (--fs-dy) plus a
                // mid-crossing waypoint (--fs-dy-mid) that bows the path.
                ["--fs-dy" as string]: s.dy,
                ["--fs-dy-mid" as string]: s.dyMid,
              };
          return (
            <div
              key={k}
              className={reduce ? "absolute" : "fs-swimlane absolute left-0"}
              style={style}
            >
              <span
                className={reduce ? "block h-full w-full" : "fs-swimwig block h-full w-full"}
                // Desync each creature's bob (own duration + delay) so the field
                // doesn't pulse in unison.
                style={
                  reduce
                    ? undefined
                    : { animationDuration: s.wigDur, animationDelay: `${(-k * 0.6).toFixed(1)}s` }
                }
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
            // Determinate fill, synced to the field envelope: it reaches the end
            // as the silhouettes fade out, then both restart invisibly.
            <div className="fs-loadfill absolute inset-y-0 left-0 rounded-full bg-teal-400" />
          )}
        </div>
      </div>
    </main>
  );
}
