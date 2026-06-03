"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The landing hero's "the app plays itself" preview: a real, muted,
 * looping snippet in a rounded frame with a faux candidate-pick overlay
 * that scans the chips and locks onto the reference answer, then resets.
 * This shows the core loop (spot -> reveal) in ~5 seconds without the
 * visitor clicking anything.
 *
 * Motion is JS-driven (the chip cycle), so it guards on
 * prefers-reduced-motion directly: reduced-motion users see the answer
 * chip already revealed, static.
 */

type Props = {
  videoUrl: string;
  poster: string;
  /** Display label of the reference answer (common name). */
  answer: string;
  /** Other plausible labels shown as distractor chips. */
  distractors: string[];
  /** Site label for the field-note caption. */
  site: string;
};

// Cycle phases, in ms: scan across each chip, then dwell on the reveal.
const SCAN_MS = 850;
const REVEAL_DWELL_MS = 2600;

export function HeroPreview({ videoUrl, poster, answer, distractors, site }: Props) {
  // Build a stable chip order: answer + up to 3 distractors, answer not
  // always first. Deterministic (no Math.random) so SSR and client agree.
  const chips = [...distractors.slice(0, 3), answer];
  const answerIndex = chips.length - 1;
  // Rotate so the answer isn't always last.
  const rot = answer.length % chips.length;
  const ordered = chips.map((_, i) => chips[(i + rot) % chips.length]);
  const orderedAnswerIndex = (answerIndex - rot + chips.length) % chips.length;

  const [scanIndex, setScanIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [inView, setInView] = useState(true);
  const reduced = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // One observer drives visibility; the video and the chip cycle both pause
  // off-screen so neither burns CPU/battery while scrolled away.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.25 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Play / pause the looping video with visibility.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (inView) v.play().catch(() => {});
    else v.pause();
  }, [inView]);

  // Chip scan/reveal cycle. Guards reduced-motion (static reveal) and only
  // runs while in view; re-entering the viewport restarts a fresh scan.
  useEffect(() => {
    reduced.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced.current) {
      setScanIndex(orderedAnswerIndex);
      setRevealed(true);
      return;
    }
    if (!inView) return;

    let timer: ReturnType<typeof setTimeout>;
    let step = 0; // 0..ordered.length-1 = scanning, then reveal

    const tick = () => {
      if (step < ordered.length) {
        setScanIndex(step);
        setRevealed(false);
        step += 1;
        timer = setTimeout(tick, SCAN_MS);
      } else {
        setScanIndex(orderedAnswerIndex);
        setRevealed(true);
        step = 0;
        timer = setTimeout(tick, REVEAL_DWELL_MS);
      }
    };
    timer = setTimeout(tick, SCAN_MS);
    return () => clearTimeout(timer);
    // ordered/orderedAnswerIndex derive from stable props; inView gates it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);

  return (
    <div ref={rootRef} className="fs-float relative mx-auto w-full max-w-sm">
      {/* Glow halo behind the frame. */}
      <div className="absolute -inset-3 rounded-card bg-teal-500/20 blur-2xl" aria-hidden="true" />

      <div className="relative overflow-hidden rounded-card border border-white/40 bg-navy-900 shadow-panel">
        <div className="relative aspect-[3/4]">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            src={videoUrl}
            poster={poster}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          />

          {/* Readability gradient. */}
          <div className="absolute inset-0 bg-gradient-to-t from-navy-900/85 via-navy-900/10 to-navy-900/30" />

          {/* Corner reticle brackets. */}
          <div className="pointer-events-none absolute inset-4" aria-hidden="true">
            {(["left-0 top-0", "right-0 top-0", "left-0 bottom-0", "right-0 bottom-0"] as const).map(
              (pos, i) => (
                <span
                  key={i}
                  className={`absolute h-5 w-5 border-teal-300/80 ${pos} ${
                    pos.includes("top") ? "border-t-2" : "border-b-2"
                  } ${pos.includes("left") ? "border-l-2" : "border-r-2"} rounded-[3px]`}
                />
              ),
            )}
          </div>

          {/* Top label. */}
          <div className="absolute left-4 top-4 flex items-center gap-2">
            <span aria-hidden="true" className="flex h-2 w-2 items-center justify-center">
              <span className="absolute h-2 w-2 animate-ping rounded-full bg-teal-300/70" />
              <span className="h-2 w-2 rounded-full bg-teal-300" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-eyebrow text-white/90">
              Spot the species
            </span>
          </div>

          {/* Bottom: faux candidate chips. */}
          <div className="absolute inset-x-3 bottom-3">
            <p className="mb-2 text-[11px] text-white/70">{site}</p>
            <div className="grid grid-cols-2 gap-2">
              {ordered.map((label, i) => {
                const isAnswer = i === orderedAnswerIndex;
                const scanning = !revealed && i === scanIndex;
                const lockedCorrect = revealed && isAnswer;
                return (
                  <div
                    key={`${label}-${i}`}
                    className={[
                      "flex items-center justify-between gap-1 rounded-full border px-3 py-2 text-xs font-semibold transition-all duration-300",
                      lockedCorrect
                        ? "border-correct bg-correct text-correct-ink"
                        : scanning
                          ? "border-teal-300 bg-white/25 text-white"
                          : "border-white/25 bg-white/10 text-white/85",
                    ].join(" ")}
                  >
                    <span className="truncate">{label}</span>
                    {lockedCorrect && (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path
                          d="M2.5 7.5l3 3 6-7"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
