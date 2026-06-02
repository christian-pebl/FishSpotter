"use client";

import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useCreatureQuiz } from "@/lib/useCreatureQuiz";

interface SnippetPlayerProps {
  snippet: {
    id: string;
    videoUrl: string;
    thumbnailUrl: string;
    site: string;
    deployment: string;
    depthM: number | null;
    recordingDatetime: string | null;
    /** Reference identification. Null when the snippet has no reference yet (S7-T1). */
    staffAnswer: string | null;
  };
}

export function SnippetPlayer({ snippet }: SnippetPlayerProps) {
  const {
    session,
    status,
    myAnswer,
    stats,
    submitting,
    answerText,
    setAnswerText,
    submitError,
    handleSubmit,
  } = useCreatureQuiz(snippet, `/feed/${snippet.id}`);

  const reduceMotion = useReducedMotion();
  const showStats = myAnswer && stats;

  return (
    <div className="space-y-6">
      <div className="pebl-surface overflow-hidden rounded-hero p-3">
        <div className="relative mx-auto aspect-[9/16] max-h-[70vh] overflow-hidden rounded-card bg-navy-900">
        <video
          src={snippet.videoUrl}
          poster={snippet.thumbnailUrl}
          controls
          className="w-full h-full object-contain"
          playsInline
        />
        </div>
      </div>

      <div className="pebl-surface rounded-card p-5 text-sm text-[color:var(--muted)]">
        <p className="text-xs font-semibold uppercase tracking-eyebrow text-[color:var(--primary)]">PEBL observation details</p>
        <div className="mt-3 grid gap-1 md:grid-cols-2">
          <p><span className="font-medium text-[color:var(--foreground)]">Site:</span> {snippet.site}</p>
          <p><span className="font-medium text-[color:var(--foreground)]">Deployment:</span> {snippet.deployment}</p>
          {snippet.depthM != null && <p><span className="font-medium text-[color:var(--foreground)]">Depth:</span> {snippet.depthM}m</p>}
          {snippet.recordingDatetime && <p><span className="font-medium text-[color:var(--foreground)]">Recorded:</span> {snippet.recordingDatetime}</p>}
        </div>
      </div>

      <div className="pebl-surface rounded-card p-5">
        <p className="text-xs font-semibold uppercase tracking-eyebrow text-[color:var(--primary)]">Spotter challenge</p>
        <h2 className="mt-2 font-brand-heading text-3xl text-[color:var(--foreground)]">What species is this?</h2>

        {!showStats ? (
          <>
            <label
              htmlFor={`species-answer-${snippet.id}`}
              className="mb-2 mt-4 block text-xs font-semibold uppercase tracking-eyebrow text-[color:var(--primary)]"
            >
              Species name
            </label>
            <input
              id={`species-answer-${snippet.id}`}
              type="text"
              placeholder="Type species name"
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
              autoComplete="off"
              aria-describedby={submitError ? `species-error-${snippet.id}` : undefined}
              aria-invalid={!!submitError}
              className="mb-4 w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted)] focus:border-[color:var(--primary)]"
              style={{
                color: "var(--foreground)",
                WebkitTextFillColor: "var(--foreground)",
                caretColor: "var(--primary)",
              }}
            />
            {/* S2-T16: correction chip removed. The MCQ picker (S2-T14)
                replaces spelling ambiguity and the alias matcher
                (S2-T01) catches synonyms server-side. */}
            {submitError && (
              <p
                id={`species-error-${snippet.id}`}
                role="alert"
                className="mb-4 text-sm font-medium text-red-700"
              >
                {submitError}
              </p>
            )}
            <motion.button
              type="button"
              onClick={() => {
                void handleSubmit();
              }}
              disabled={!answerText.trim() || submitting}
              aria-busy={submitting}
              whileTap={!submitting && answerText.trim() && !reduceMotion ? { scale: 0.97 } : undefined}
              className="pebl-button-primary inline-flex items-center justify-center min-h-[44px] rounded-full px-6 py-3 font-semibold disabled:cursor-not-allowed disabled:bg-[color:var(--accent)]/70 disabled:text-[color:var(--foreground)]/70"
            >
              {submitting ? "Submitting…" : "Confirm selection"}
            </motion.button>
            {status !== "loading" && !session && (
              <p className="mt-3 text-sm text-[color:var(--muted)]">
                <Link href={`/auth/signin?callbackUrl=${encodeURIComponent(`/feed/${snippet.id}`)}`} className="text-[color:var(--primary)] underline underline-offset-4">
                  Sign in
                </Link> to contribute your answer and appear on the community leaderboard.
              </p>
            )}
          </>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={
                myAnswer.isCorrect === null
                  ? "pending"
                  : myAnswer.isCorrect
                    ? "correct"
                    : "wrong"
              }
              initial={
                reduceMotion
                  ? false
                  : myAnswer.isCorrect === false
                    ? { x: 0 }
                    : { scale: 0.9, opacity: 0 }
              }
              animate={
                reduceMotion
                  ? { opacity: 1 }
                  : myAnswer.isCorrect === false
                    ? { x: [0, -10, 10, -8, 8, 0] }
                    : { scale: 1, opacity: 1 }
              }
              transition={
                myAnswer.isCorrect === false
                  ? { duration: 0.4 }
                  : { type: "spring", stiffness: 300, damping: 20 }
              }
              className="mt-4 space-y-4"
            >
              <p className="font-medium text-[color:var(--primary)] flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>You said: {myAnswer.chosenOption}</span>
                {myAnswer.isCorrect === true && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, delay: 0.1 }}
                    className="inline-flex items-center gap-1 rounded-full bg-correct px-2 py-0.5 text-[11px] font-bold tracking-wide text-correct-ink"
                    aria-label="Correct, plus 2 points"
                  >
                    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
                      <path d="M2 6.5l2.5 2.5L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Correct · +2
                  </motion.span>
                )}
                {myAnswer.isCorrect === false && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-incorrect px-2 py-0.5 text-[11px] font-bold tracking-wide text-incorrect-ink"
                    aria-label="Wrong"
                  >
                    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
                      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    Wrong
                  </span>
                )}
                {myAnswer.isCorrect === null && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, delay: 0.1 }}
                    className="inline-flex items-center gap-1 rounded-full bg-pending px-2 py-0.5 text-[11px] font-bold tracking-wide text-pending-ink"
                    aria-label="Bonus, plus 1 point"
                  >
                    <svg viewBox="0 0 14 14" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
                      <path d="M7 1.5l1.6 3.5 3.8.4-2.8 2.6.8 3.7L7 10.4 3.4 12.2l.8-3.7L1.4 5.9l3.8-.4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                    </svg>
                    +1 Bonus
                  </motion.span>
                )}
              </p>
              <div>
                <h3 className="mb-2 font-medium text-[color:var(--foreground)]">Community response</h3>
                <ul className="space-y-1">
                  {stats.stats.map((s) => (
                    <li key={s.option} className="flex items-center gap-2">
                      <span className="w-24">{s.option}</span>
                      <span className="text-[color:var(--muted)]">{s.percent}%</span>
                      <div className="max-w-[200px] flex-1 overflow-hidden rounded bg-[color:var(--surface-muted)] h-2">
                        <div className="h-full rounded bg-[color:var(--accent)]" style={{ width: `${s.percent}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
                {/* S7-T1: staffAnswer is null when the snippet has no reference yet. */}
                {stats.staffAnswer ? (
                  <p className="mt-2 text-sm text-[color:var(--muted)]">Reference: {stats.staffAnswer}</p>
                ) : (
                  <p
                    className="mt-2 inline-flex items-center gap-1 rounded-full bg-pending px-2 py-0.5 text-[11px] font-bold tracking-wide text-pending-ink"
                    aria-label="Bonus, plus 1 point. Reference identification pending."
                  >
                    <svg viewBox="0 0 14 14" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
                      <path d="M7 1.5l1.6 3.5 3.8.4-2.8 2.6.8 3.7L7 10.4 3.4 12.2l.8-3.7L1.4 5.9l3.8-.4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                    </svg>
                    +1 Bonus · reference pending
                  </p>
                )}
              </div>
              <Link href="/feed" className="inline-flex text-[color:var(--primary)] underline underline-offset-4">
                ← Back to live feed
              </Link>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
