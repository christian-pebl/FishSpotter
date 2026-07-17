"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { DURATION, EASE, spring } from "@/lib/motion";

/**
 * The onboarding tour's "here's exactly what you'll see" panel: the SAME real,
 * muted, looping clip used on the landing hero (a velvet crab at Pabay, Isle of
 * Skye — see HeroPreview.tsx / the pinned hero clip in src/app/page.tsx), with a
 * guided cursor walking through one real identification: watch a beat of the
 * clip, tap Identify, pick the highlighted option, see it lock in. Steps 2 and 3
 * layer the reveal (reference + community histogram + Pebbles) and the streak
 * counter over the same still-playing clip, so the whole tour reads as one
 * continuous card rather than three disconnected mockups.
 */

const VIDEO_URL =
  "https://aazxphcrexkggbmmceli.supabase.co/storage/v1/object/public/snippets/KEL33_2026-04-23_08-01_velvetcrab_track_manual_0-696_20260629_112902/snippet.mp4?v=3";
const POSTER_URL =
  "https://aazxphcrexkggbmmceli.supabase.co/storage/v1/object/public/snippets/KEL33_2026-04-23_08-01_velvetcrab_track_manual_0-696_20260629_112902/thumbnail.jpg?v=3";
const SITE = "Pabay, Inner Sound, Isle of Skye, UK";
const CHIPS = ["Velvet crab", "Brown crab", "Hermit crab", "Spider crab"];
const TARGET_INDEX = 0; // "Velvet crab" — the animal actually in this clip.

// Percent-of-card positions the cursor visits. Tuned by eye against the
// rendered 3:4 card; not measured from the DOM since the layout is fixed.
const CURSOR_AT = {
  rest: { left: "88%", top: "94%" },
  identifyPill: { left: "50%", top: "82%" },
  chip: { left: "27%", top: "83%" },
};

type Phase = "watch" | "cursorIn" | "tapIdentify" | "chipsIn" | "highlight" | "tapChip" | "locked";

const WATCH_MS = 1400;
const HOLD_LOCKED_MS = 1600;

export function TourPreview({ step }: { step: 0 | 1 | 2 }) {
  const reduce = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>(reduce ? "locked" : "watch");

  useEffect(() => {
    videoRef.current?.play().catch(() => {});
  }, []);

  // Step 1 owns a self-playing watch -> tap -> pick -> lock sequence, looped
  // a couple of times then held at rest (never perpetual). Steps 2/3 don't
  // need the sequence — they render their own static-reached state directly.
  useEffect(() => {
    if (step !== 0) return;
    if (reduce) {
      setPhase("locked");
      return;
    }
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(() => !cancelled && fn(), ms));

    function runOnce(onDone: () => void) {
      setPhase("watch");
      at(WATCH_MS, () => setPhase("cursorIn"));
      at(WATCH_MS + 350, () => setPhase("tapIdentify"));
      at(WATCH_MS + 650, () => setPhase("chipsIn"));
      at(WATCH_MS + 1050, () => setPhase("highlight"));
      at(WATCH_MS + 1750, () => setPhase("tapChip"));
      at(WATCH_MS + 2050, () => setPhase("locked"));
      at(WATCH_MS + 2050 + HOLD_LOCKED_MS, onDone);
    }

    let loops = 0;
    function loop() {
      if (cancelled) return;
      loops += 1;
      if (loops >= 2) {
        runOnceFinal();
        return;
      }
      runOnce(loop);
    }
    // Final pass: same sequence, but stays locked at rest instead of resetting.
    function runOnceFinal() {
      setPhase("watch");
      at(WATCH_MS, () => setPhase("cursorIn"));
      at(WATCH_MS + 350, () => setPhase("tapIdentify"));
      at(WATCH_MS + 650, () => setPhase("chipsIn"));
      at(WATCH_MS + 1050, () => setPhase("highlight"));
      at(WATCH_MS + 1750, () => setPhase("tapChip"));
      at(WATCH_MS + 2050, () => setPhase("locked"));
    }
    loop();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [step, reduce]);

  // Step 3 (streak) is a different, unrelated moment — the crab pick chip
  // from step 1 shouldn't linger behind it (it painted on top since it comes
  // later in JSX than the streak panel, with no z-index between them).
  const showChips =
    step === 1 || (step === 0 && (phase === "chipsIn" || phase === "highlight" || phase === "tapChip" || phase === "locked"));
  const chipsLocked = step > 0 || phase === "locked";
  const showIdentifyPill = step === 0 && (phase === "watch" || phase === "cursorIn" || phase === "tapIdentify");
  const showCursor = step === 0 && !reduce && phase !== "watch" && phase !== "locked";
  const cursorTarget =
    phase === "tapIdentify" ? CURSOR_AT.identifyPill
    : phase === "cursorIn" ? CURSOR_AT.identifyPill
    : CURSOR_AT.chip;

  return (
    <div className="relative overflow-hidden rounded-card border border-white/15 bg-navy-900">
      {/* Fixed height + w-full (not aspect-ratio + max-height together): a
          plain block div sizes aspect-ratio from the CONSTRAINED height when
          width is auto, which left this filling only part of the card. */}
      <div className="relative h-[240px] w-full">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          src={VIDEO_URL}
          poster={POSTER_URL}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-900/88 via-navy-900/15 to-navy-900/35" />

        {/* Corner reticle — matches the landing hero preview's frame language. */}
        <div className="pointer-events-none absolute inset-3" aria-hidden="true">
          {(["left-0 top-0", "right-0 top-0", "left-0 bottom-0", "right-0 bottom-0"] as const).map((pos, i) => (
            <span
              key={i}
              className={`absolute h-4 w-4 border-teal-300/70 ${pos} ${
                pos.includes("top") ? "border-t-2" : "border-b-2"
              } ${pos.includes("left") ? "border-l-2" : "border-r-2"} rounded-[3px]`}
            />
          ))}
        </div>

        <p className="absolute left-3 top-3 text-[10px] font-semibold uppercase tracking-eyebrow text-white/85">
          {SITE}
        </p>

        {/* The reveal overlay (step 2): reference badge + community histogram + pebbles. */}
        <AnimatePresence>
          {step === 1 && (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.standard, ease: EASE.enter }}
              className="absolute inset-x-3 top-9 space-y-1.5"
            >
              <span className="inline-block rounded-full border border-teal-300/40 bg-teal-500/15 px-2.5 py-1 text-[10px] font-semibold text-teal-100">
                Reference: Velvet crab
              </span>
              {[
                { label: "Velvet crab", pct: 68 },
                { label: "Brown crab", pct: 21 },
              ].map((row, i) => (
                <div key={row.label} className="flex items-center gap-2 text-[10px] text-white/70">
                  <span className="w-16 shrink-0 truncate">{row.label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-teal-300"
                      initial={reduce ? false : { width: 0 }}
                      animate={{ width: `${row.pct}%` }}
                      transition={{ duration: DURATION.layout, ease: EASE.enter, delay: reduce ? 0 : 0.15 + i * 0.1 }}
                    />
                  </div>
                </div>
              ))}
              <motion.span
                initial={reduce ? false : { opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={reduce ? undefined : { ...spring.cheer, delay: 0.5 }}
                className="inline-block rounded-full bg-teal-400 px-2.5 py-1 text-[10px] font-semibold text-navy-900"
              >
                +7 pebbles
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The streak overlay (step 3). */}
        <AnimatePresence>
          {step === 2 && (
            <motion.div
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: DURATION.standard }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            >
              <div className="flex items-baseline gap-2">
                <motion.svg
                  width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                  className="text-teal-300"
                  initial={reduce ? false : { scale: 1 }}
                  animate={reduce ? {} : { scale: [1, 1.18, 1] }}
                  transition={reduce ? undefined : { duration: 0.5, delay: 0.6, ease: EASE.enter }}
                >
                  <path d="M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c1.5 1 2 3 2 4.5A5 5 0 0 1 7 15c0-3 2-5 2-8 1 1 1.5 2 1 3.5C11 8 12 5 12 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                </motion.svg>
                <StreakCount reduce={!!reduce} />
              </div>
              <div className="flex gap-1.5" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.span
                    key={i}
                    className="h-2 w-2 rounded-full bg-white/15"
                    animate={i <= 2 ? { backgroundColor: "#5eead4" } : undefined}
                    transition={{ duration: DURATION.micro, delay: reduce ? 0 : 0.5 + i * 0.12 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 1: the Identify pill (pre-tap). */}
        <AnimatePresence>
          {showIdentifyPill && (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: phase === "tapIdentify" && !reduce ? 0.93 : 1,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.micro }}
              className="absolute inset-x-3 bottom-3 flex items-center justify-center gap-1.5 rounded-full border border-teal-500/40 bg-teal-500/10 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-teal-50"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              Identify
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 1 (post-tap) / step 2 / step 3-entry: the candidate chip grid. */}
        <AnimatePresence>
          {showChips && (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.standard, ease: EASE.enter }}
              className="absolute inset-x-3 bottom-3 grid grid-cols-2 gap-1.5"
            >
              {CHIPS.map((label, i) => {
                const isTarget = i === TARGET_INDEX;
                const highlighted = step === 0 && (phase === "highlight" || phase === "tapChip") && isTarget;
                const locked = chipsLocked && isTarget;
                const pressed = step === 0 && phase === "tapChip" && isTarget && !reduce;
                return (
                  <motion.div
                    key={label}
                    animate={{ scale: pressed ? 0.93 : 1, opacity: chipsLocked && !isTarget ? 0.4 : 1 }}
                    transition={{ duration: DURATION.micro }}
                    className={[
                      "relative flex items-center justify-between gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold",
                      locked
                        ? "border-correct bg-correct text-correct-ink"
                        : "border-white/25 bg-white/10 text-white/85",
                    ].join(" ")}
                  >
                    <span className="truncate">{label}</span>
                    {locked && (
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path d="M2.5 7.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {highlighted && !locked && (
                      <motion.span
                        aria-hidden="true"
                        className="pointer-events-none absolute -inset-1 rounded-full border-[1.5px] border-teal-300"
                        initial={{ opacity: 0.9, scale: 1 }}
                        animate={{ opacity: 0, scale: 1.35 }}
                        transition={{ duration: 0.9, ease: EASE.exit, repeat: Infinity }}
                      />
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* The guided cursor — the "here's where to tap" motion. */}
        <AnimatePresence>
          {showCursor && (
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
              initial={{ opacity: 0, ...CURSOR_AT.rest }}
              animate={{ opacity: 1, ...cursorTarget }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.layout, ease: EASE.enter }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}>
                <path d="M4 2l14 8-6 2 3 7-3 1-3-7-5 4z" />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StreakCount({ reduce }: { reduce: boolean }) {
  const [n, setN] = useState(2);
  useEffect(() => {
    if (reduce) {
      setN(3);
      return;
    }
    const t = setTimeout(() => setN(3), 700);
    return () => clearTimeout(t);
  }, [reduce]);
  return <span className="text-2xl font-bold text-white">{n}</span>;
}
