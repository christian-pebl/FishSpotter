"use client";

/**
 * Post-submit reveal shown after a user commits a species guess. A compact
 * "You said X" result line (with the scored verdict chip) followed by the
 * Community answers panel: the live histogram of what everyone else guessed,
 * each row showing how many spotters gave that answer (species or higher
 * level), the user's own pick highlighted, animated bars, and the spotter
 * count.
 *
 * The PEBL-reference / "PEBL ID" + "Closest confirmed ID" panel was removed —
 * the reveal is community-answers only.
 *
 * Reveals as a staggered sequence with a teal confetti burst on a correct call;
 * collapses to an instant static state under prefers-reduced-motion.
 */

import { useEffect, useRef } from "react";
import { motion, type Variants } from "framer-motion";
import { DURATION, EASE } from "@/lib/motion";
import { normalizeAnswer } from "@/lib/normalize-answer";
import { isContested } from "@/lib/pebbles";
import { CorrectFishSwim } from "./CorrectFishSwim";

export type RevealStatsItem = { option: string; count: number; percent: number };

export function RevealResult({
  chosenOption,
  isCorrect,
  stats,
  total,
  reduceMotion,
  streakCurrent,
  streakAdvanced,
  unlock,
  pebblesEarned,
  firstSighting,
}: {
  chosenOption: string;
  isCorrect: boolean | null;
  stats: RevealStatsItem[];
  total: number;
  reduceMotion: boolean;
  /** T-07 reward progress (authed only): the day-streak total + whether it just
   * advanced, and whether this correct ID added a NEW collection species. */
  streakCurrent?: number;
  streakAdvanced?: boolean;
  unlock?: { isNew: boolean; commonName: string; collectionCount: number } | null;
  /** Sea-currency: Pebbles earned by this submission + First Sighting flag. */
  pebblesEarned?: number;
  firstSighting?: boolean;
}) {
  // Teal confetti once, on a correct call only. Fired imperatively so it does
  // not re-trigger on re-render; skipped entirely under reduced-motion.
  const firedRef = useRef(false);
  useEffect(() => {
    if (isCorrect !== true || reduceMotion || firedRef.current) return;
    firedRef.current = true;
    import("canvas-confetti")
      .then(({ default: confetti }) => {
        confetti({
          particleCount: 72,
          spread: 66,
          startVelocity: 38,
          gravity: 0.9,
          scalar: 0.8,
          ticks: 140,
          origin: { y: 0.4 },
          colors: ["#3AAFA9", "#5eead4", "#DEF2F1", "#ffffff"],
          disableForReducedMotion: true,
        });
      })
      .catch(() => {});
  }, [isCorrect, reduceMotion]);

  const myKey = normalizeAnswer(chosenOption);
  const top = stats.slice(0, 6);
  // T-09: did the user's own guess land anywhere in the community histogram?
  // For guests (whose pick is never persisted) it won't, so we surface it
  // explicitly below instead of leaving them absent from the crowd.
  const myInTop = top.some((s) => normalizeAnswer(s.option) === myKey);

  const container: Variants = reduceMotion
    ? { hidden: {}, show: {} }
    : { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } } };
  const item: Variants = reduceMotion
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: { duration: DURATION.standard, ease: EASE.enter } },
      };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="relative pb-1">
      {/* Correct-only line-fish swim-by: a faint, behind-the-text flourish that
          darts across once and self-unmounts. Mounted only on a correct call so
          it never plays on a miss/pending; it does not touch the staggered
          reveal or the confetti (both above), and renders nothing under reduced
          motion. */}
      {isCorrect === true && <CorrectFishSwim reduceMotion={reduceMotion} />}

      {/* Sea-currency: the Pebbles this submission banked, landed in place at the
          moment of the reveal (it also flies into the header pouch). First
          Sighting gets brighter copy — you were the first to ever log this clip. */}
      {!!pebblesEarned && pebblesEarned > 0 && (
        <motion.div variants={item} className="mt-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/15 px-3 py-1 text-xs font-semibold text-teal-200">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
              <ellipse cx="8" cy="9" rx="6.5" ry="5" fill="currentColor" />
              <ellipse cx="6" cy="6.6" rx="2.4" ry="1.4" fill="#ffffff" opacity="0.4" />
            </svg>
            +{pebblesEarned} {pebblesEarned === 1 ? "Pebble" : "Pebbles"}
            {firstSighting && (
              <span className="ml-0.5 text-teal-100">· First Sighting!</span>
            )}
          </span>
        </motion.div>
      )}

      {/* Community answers — how many spotters gave each answer (species or
          higher level). Sole panel: the PEBL-reference panel was removed. */}
      <motion.div variants={item} className="mt-2">
        <div className="rounded-modal border border-white/10 bg-white/[0.06] p-3">
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 14 14" className="h-3 w-3 text-white/45" fill="none" aria-hidden="true">
              <circle cx="5" cy="4.2" r="2" stroke="currentColor" strokeWidth="1.2" />
              <path d="M1.5 11.5c0-2 1.6-3.3 3.5-3.3s3.5 1.3 3.5 3.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M9.3 8.4c1.6.1 2.9 1.3 2.9 3.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="10" cy="4.6" r="1.6" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <span className="text-[10px] font-semibold uppercase tracking-eyebrow text-white/55">
              Community answers · {total} {total === 1 ? "spotter" : "spotters"}
            </span>
            {isContested(stats, total) && (
              <span
                className="ml-auto inline-flex items-center gap-1 rounded-full bg-pending/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow text-pending"
                title="The community is split on this one — a tricky clip worth a closer look."
              >
                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
                  <path d="M6 1v6M6 9.5v1.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                Contested
              </span>
            )}
          </div>
          <div className="mt-2 space-y-1.5">
            {total === 0 ? (
              <p className="text-[11px] text-white/45">Be the first to call this one.</p>
            ) : (
              <>
                {top.map((s, i) => {
                  const mine = normalizeAnswer(s.option) === myKey;
                  return (
                    <div key={s.option} className="flex items-center gap-2 text-xs">
                      <span
                        className={`w-24 shrink-0 truncate ${mine ? "font-semibold text-teal-200" : "text-white/80"}`}
                        title={s.option}
                      >
                        {s.option}
                        {mine && <span className="text-teal-300/80"> · you</span>}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded bg-white/10">
                        <motion.div
                          className={`h-full rounded ${mine ? "bg-teal-400" : "bg-teal-500/60"}`}
                          initial={reduceMotion ? false : { width: 0 }}
                          animate={{ width: `${s.percent}%` }}
                          transition={
                            reduceMotion
                              ? undefined
                              : { duration: DURATION.layout, ease: EASE.enter, delay: 0.14 + i * 0.07 }
                          }
                        />
                      </div>
                      <span className="w-20 shrink-0 text-right tabular-nums text-white/60">
                        {s.count} {s.count === 1 ? "spotter" : "spotters"}
                      </span>
                    </div>
                  );
                })}
                {/* Always show the user's own pick, even when it isn't a common
                    call (always the case for a guest's read-only preview). */}
                {!myInTop && (
                  <div className="flex items-center gap-2 pt-0.5 text-xs">
                    <span className="w-24 shrink-0 truncate font-semibold text-teal-200" title={chosenOption}>
                      {chosenOption}
                      <span className="font-normal text-teal-300/80"> · you</span>
                    </span>
                    <span className="flex-1 text-[10px] italic text-white/40">your pick</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* T-07: the win visibly accumulates - collection + streak land right here
          at the reward moment (authed only; guests get the sign-up nudge). */}
      {(unlock?.isNew || streakAdvanced) && (
        <motion.div variants={item} className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
          {unlock?.isNew && (
            <span className="inline-flex items-center gap-1 rounded-full bg-correct/15 px-2.5 py-1 font-semibold text-correct">
              <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden="true">
                <path d="M2 6.5l2.5 2.5L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {unlock.commonName} added to your collection · {unlock.collectionCount} of 57
            </span>
          )}
          {streakAdvanced && streakCurrent != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/15 px-2.5 py-1 font-semibold text-teal-200">
              <svg viewBox="0 0 14 14" className="h-3 w-3" fill="currentColor" aria-hidden="true">
                <path d="M7 1.4c2.2 2.6.7 4.2.7 5.3a2 2 0 1 1-3.4-.1C4.6 4.7 7 4.1 7 1.4z" />
              </svg>
              Day {streakCurrent} streak
            </span>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
