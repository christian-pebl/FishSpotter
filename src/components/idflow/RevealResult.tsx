"use client";

/**
 * Post-submit reveal: the slick two-panel result shown after a user commits a
 * species guess (replaces the old single "You said X · reference: Y" line +
 * thin histogram in FeedCard).
 *
 * Two results, side by side (stacked on mobile):
 *   - PEBL ID     : the authoritative internal reference we assign the species
 *                   (resolvePeblId -> the hardcoded ID, falling back to the
 *                   clip's staffAnswer until the raw IDs are wired in).
 *   - Community   : the live histogram of what everyone else guessed, with the
 *                   user's own pick highlighted, animated bars, and the spotter
 *                   count.
 *
 * The whole thing reveals as an orchestrated, staggered sequence (headline ->
 * panels -> bars grow), with a teal confetti burst on a correct call. All of it
 * collapses to an instant, static final state under prefers-reduced-motion.
 */

import { useEffect, useRef } from "react";
import { motion, type Variants } from "framer-motion";
import { DURATION, EASE } from "@/lib/motion";
import { normalizeAnswer } from "@/lib/normalize-answer";
import { resolvePeblId } from "@/data/pebl-ids";
import { CorrectFishSwim } from "./CorrectFishSwim";

export type RevealStatsItem = { option: string; count: number; percent: number };

// Coarse reference labels: a clip confirmed only to a group, not a species.
// When the PEBL reference is one of these, we frame it as an invitation (T-10)
// rather than letting a one-word "Fish" read as an anticlimax to a user who
// guessed something specific.
const COARSE_REFS = new Set([
  "fish", "crab", "flatfish", "jellyfish", "starfish", "squid", "gastropod",
  "snail / slug", "snail", "slug", "octopus", "shrimp", "prawn", "anemone",
  "worm", "eel", "ray", "shark", "goby", "wrasse", "blenny",
]);

export function RevealResult({
  chosenOption,
  isCorrect,
  revealPartial,
  staffAnswer,
  staffScientific,
  stats,
  total,
  reduceMotion,
  streakCurrent,
  streakAdvanced,
  unlock,
}: {
  chosenOption: string;
  isCorrect: boolean | null;
  /** true when wrong-species-but-right-shape-class (partial +1 credit). */
  revealPartial: boolean;
  /** PEBL reference label for the clip (null = no reference yet). */
  staffAnswer: string | null;
  /** Resolved scientific name (arrives after StaffScientificResolver fetches it). */
  staffScientific: string | null;
  stats: RevealStatsItem[];
  total: number;
  reduceMotion: boolean;
  /** T-07 reward progress (authed only): the day-streak total + whether it just
   * advanced, and whether this correct ID added a NEW collection species. */
  streakCurrent?: number;
  streakAdvanced?: boolean;
  unlock?: { isNew: boolean; commonName: string; collectionCount: number } | null;
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

  const peblId = resolvePeblId(staffAnswer);
  const isCoarse = !!staffAnswer && COARSE_REFS.has(staffAnswer.trim().toLowerCase());
  const myKey = normalizeAnswer(chosenOption);
  const top = stats.slice(0, 4);
  // T-09: did the user's own guess land anywhere in the community histogram?
  // For guests (whose pick is never persisted) it won't, so we surface it
  // explicitly below instead of leaving them absent from the crowd.
  const myInTop = top.some((s) => normalizeAnswer(s.option) === myKey);
  const lowN = total <= 2;

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

      {/* Verdict headline (aria-live announces the outcome; icons + text so the
          result never depends on colour alone). */}
      <motion.p
        variants={item}
        role="status"
        aria-live="polite"
        className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm"
      >
        <span className="text-white/85">You said</span>
        <span className="font-semibold text-white">{chosenOption}</span>
        {isCorrect === true && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-correct px-2.5 py-1 text-xs font-bold tracking-wide text-correct-ink shadow-sm"
            aria-label="Correct, plus 2 points"
          >
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
              <path d="M2 6.5l2.5 2.5L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Correct · +2
          </span>
        )}
        {isCorrect === false &&
          (revealPartial ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-pending px-2.5 py-1 text-xs font-bold tracking-wide text-pending-ink shadow-sm"
              aria-label="Close, right shape class, plus 1 point"
            >
              <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
                <path d="M2 4.5q1.5-1.6 3 0t3 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M2 8q1.5-1.6 3 0t3 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Close · +1
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-incorrect px-2.5 py-1 text-xs font-bold tracking-wide text-incorrect-ink shadow-sm"
              aria-label="Incorrect"
            >
              <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
                <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Wrong
            </span>
          ))}
        {isCorrect === null && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-pending px-2.5 py-1 text-xs font-bold tracking-wide text-pending-ink shadow-sm"
            aria-label="Bonus, plus 1 point. Reference identification pending."
          >
            <svg viewBox="0 0 14 14" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
              <path d="M7 1.5l1.6 3.5 3.8.4-2.8 2.6.8 3.7L7 10.4 3.4 12.2l.8-3.7L1.4 5.9l3.8-.4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
            +1 Bonus
          </span>
        )}
      </motion.p>

      {/* Two result panels: PEBL ID vs Community. */}
      <motion.div variants={item} className="mt-2 flex flex-col gap-2 md:flex-row md:gap-3">
        {/* PEBL ID — the authoritative reference. */}
        <div className="flex-1 rounded-modal border border-white/10 bg-white/[0.06] p-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" aria-hidden="true" />
            <span className="text-[10px] font-semibold uppercase tracking-eyebrow text-teal-100/80">
              {isCoarse ? "Closest confirmed ID" : "PEBL ID"}
            </span>
          </div>
          {peblId ? (
            <>
              <p className="mt-1 text-base font-semibold leading-tight text-white">{peblId}</p>
              {staffScientific && !isCoarse && (
                <p className="text-[11px] italic text-white/55">{staffScientific}</p>
              )}
              {isCoarse && (
                <p className="mt-0.5 text-[11px] leading-snug text-white/60">
                  Not confirmed to species yet. Your &ldquo;{chosenOption}&rdquo; is logged and counts toward the community ID.
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-[12px] leading-snug text-white/65">
              No reference yet. Your ID helps build the dataset.
            </p>
          )}
        </div>

        {/* Community — what everyone else guessed. */}
        <div className="flex-1 rounded-modal border border-white/10 bg-white/[0.06] p-2.5">
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 14 14" className="h-3 w-3 text-white/45" fill="none" aria-hidden="true">
              <circle cx="5" cy="4.2" r="2" stroke="currentColor" strokeWidth="1.2" />
              <path d="M1.5 11.5c0-2 1.6-3.3 3.5-3.3s3.5 1.3 3.5 3.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M9.3 8.4c1.6.1 2.9 1.3 2.9 3.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="10" cy="4.6" r="1.6" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <span className="text-[10px] font-semibold uppercase tracking-eyebrow text-white/55">
              Community · {total} {total === 1 ? "spotter" : "spotters"}
            </span>
          </div>
          <div className="mt-1.5 space-y-1">
            {total === 0 ? (
              <p className="text-[11px] text-white/45">Be the first to call this one.</p>
            ) : lowN ? (
              // T-09: with only 1-2 spotters, hard percentages mislead. Frame it
              // honestly and still show the user their own pick is logged.
              <>
                <p className="text-[11px] leading-snug text-white/60">
                  You&rsquo;re one of the first to spot this. Your ID helps build the community answer.
                </p>
                <p className="text-[11px] font-semibold text-teal-200">
                  {chosenOption}
                  <span className="font-normal text-teal-300/80"> · you</span>
                </p>
              </>
            ) : (
              <>
                {top.map((s, i) => {
                  const mine = normalizeAnswer(s.option) === myKey;
                  return (
                    <div key={s.option} className="flex items-center gap-1.5 text-[11px]">
                      <span
                        className={`w-16 shrink-0 truncate ${mine ? "font-semibold text-teal-200" : "text-white/80"}`}
                        title={s.option}
                      >
                        {s.option}
                        {mine && <span className="text-teal-300/80"> · you</span>}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded bg-white/10">
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
                      <span className="w-7 shrink-0 text-right tabular-nums text-white/55">
                        {s.percent}%
                      </span>
                    </div>
                  );
                })}
                {/* T-09: always show the user's own pick, even when it isn't a
                    common call (always the case for a guest's read-only preview). */}
                {!myInTop && (
                  <div className="flex items-center gap-1.5 pt-0.5 text-[11px]">
                    <span className="w-16 shrink-0 truncate font-semibold text-teal-200" title={chosenOption}>
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
