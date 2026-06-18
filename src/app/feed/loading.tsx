"use client";

/**
 * Initial-load swim loader (replaces the old grey skeleton box). Shown by
 * Next.js as the /feed route's Suspense fallback WHILE the server fetches the
 * snippets, so it never blocks the page: the moment the feed is ready, React
 * swaps this out. Pure CSS animation (paints on the first frame, no JS needed),
 * so it starts instantly on a cold load.
 *
 * "Only on the initial app load": a sessionStorage flag means the full swim
 * animation plays once per session (the cold start, where the wait is real);
 * subsequent soft navigations to /feed get a quiet minimal loader instead of a
 * full-screen animation every time.
 *
 * Reduced motion: the CSS animations are neutralised by the global reset in
 * globals.css, and the component also renders an explicit static school (the
 * creatures spread across at rest) so opted-out users see a calm, legible
 * frame rather than a frozen off-screen one.
 */

import { useEffect, useState, type CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";

const SESSION_KEY = "fishspotter:booted";

/** Thin teal stroked line-art, currentColor so it inherits the teal text colour
 * (the house aesthetic). Each creature is a handful of paths, head facing right
 * into the left-to-right swim. */
function Fish() {
  return (
    <svg viewBox="0 0 48 28" fill="none" className="h-full w-full" aria-hidden="true">
      <path d="M8 14C12 7 22 5 32 6c7 1 12 4 13 8-1 4-6 7-13 8-10 1-20-1-24-8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 14 1 9l3 5-3 5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="37" cy="12" r="1.4" fill="currentColor" />
    </svg>
  );
}

function Squid() {
  return (
    <svg viewBox="0 0 52 30" fill="none" className="h-full w-full" aria-hidden="true">
      <path d="M22 15c2-7 12-9 21-8 6 1 9 4 9 8 0 4-3 7-9 8-9 1-19-1-21-8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M48 9l3-3v18l-3-3" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M22 13c-7-1-14-1-20 1M22 15c-8 0-15 1-21 3M22 17c-7 1-13 3-18 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function Jelly() {
  return (
    <svg viewBox="0 0 32 36" fill="none" className="h-full w-full" aria-hidden="true">
      <path d="M4 15c0-7 5-11 12-11s12 4 12 11c-3 3-6 4-12 4S7 18 4 15Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 18c-1 6-1 11-2 15M14 19c0 6 0 11-1 15M18 19c1 6 1 11 2 15M24 18c1 5 2 10 2 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

type Swimmer = { Comp: () => JSX.Element; top: string; width: number; dur: string; delay: string; rest: string };

// A small, varied school. `rest` is the left position used for the static
// (reduced-motion) tableau so the school sits spread out and legible.
const SCHOOL: Swimmer[] = [
  { Comp: Fish, top: "34%", width: 70, dur: "4.6s", delay: "0s", rest: "16%" },
  { Comp: Fish, top: "52%", width: 48, dur: "6.0s", delay: "-1.8s", rest: "44%" },
  { Comp: Squid, top: "24%", width: 58, dur: "7.4s", delay: "-3.4s", rest: "66%" },
  { Comp: Jelly, top: "60%", width: 36, dur: "8.6s", delay: "-5.2s", rest: "82%" },
];

function Caption() {
  return (
    <p className="pebl-eyebrow text-center text-teal-200/90">Spotting the reef</p>
  );
}

export default function FeedLoading() {
  const reduce = useReducedMotion();
  // First load of the app this session -> the full animation. Subsequent
  // soft-navigations -> a quiet minimal loader. SSR has no sessionStorage, so a
  // cold load is treated as "first" (the case we most want the animation for),
  // and the value matches on hydration before the effect writes the flag.
  const [first] = useState(() => {
    try {
      return typeof window === "undefined" || sessionStorage.getItem(SESSION_KEY) !== "1";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {}
  }, []);

  return (
    <main
      id="main"
      tabIndex={-1}
      className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-navy-900 px-6"
      aria-busy="true"
      aria-label="Loading the live feed"
    >
      {first ? (
        <div className="relative w-full max-w-md">
          {/* swim lane */}
          <div className="relative h-28 w-full text-teal-300" aria-hidden="true">
            {SCHOOL.map((s, i) => {
              const style: CSSProperties = reduce
                ? { top: s.top, left: s.rest, width: s.width, height: s.width * 0.6 }
                : {
                    top: s.top,
                    width: s.width,
                    height: s.width * 0.6,
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
                    <s.Comp />
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

          <div className="mt-4">
            <Caption />
          </div>
        </div>
      ) : (
        // Quiet minimal loader for repeat soft-navigations this session.
        <div className="flex flex-col items-center gap-3" aria-hidden="true">
          <div className="h-7 w-12 text-teal-300">
            <span className={reduce ? "block h-full w-full" : "fs-swimwig block h-full w-full"}>
              <Fish />
            </span>
          </div>
          <div className="relative h-1 w-28 overflow-hidden rounded-full bg-teal-300/15">
            {reduce ? (
              <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-teal-400" />
            ) : (
              <div className="fs-loadbar absolute inset-y-0 w-1/3 rounded-full bg-teal-400" />
            )}
          </div>
        </div>
      )}
    </main>
  );
}
