"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
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
    staffAnswer: string;
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
    correction,
    acceptCorrection,
    submitOriginal,
    submitError,
    handleSubmit,
  } = useCreatureQuiz(snippet, `/feed/${snippet.id}`);

  const showStats = myAnswer && stats;

  return (
    <div className="space-y-6">
      <div className="pebl-surface overflow-hidden rounded-[28px] p-3">
        <div className="relative mx-auto aspect-[9/16] max-h-[70vh] overflow-hidden rounded-[22px] bg-[#17252A]">
        <video
          src={snippet.videoUrl}
          poster={snippet.thumbnailUrl}
          controls
          className="w-full h-full object-contain"
          playsInline
        />
        </div>
      </div>

      <div className="pebl-surface rounded-[24px] p-5 text-sm text-[color:var(--muted)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">PEBL observation details</p>
        <div className="mt-3 grid gap-1 md:grid-cols-2">
          <p><span className="font-medium text-[color:var(--foreground)]">Site:</span> {snippet.site}</p>
          <p><span className="font-medium text-[color:var(--foreground)]">Deployment:</span> {snippet.deployment}</p>
          {snippet.depthM != null && <p><span className="font-medium text-[color:var(--foreground)]">Depth:</span> {snippet.depthM}m</p>}
          {snippet.recordingDatetime && <p><span className="font-medium text-[color:var(--foreground)]">Recorded:</span> {snippet.recordingDatetime}</p>}
        </div>
      </div>

      <div className="pebl-surface rounded-[24px] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">Spotter challenge</p>
        <h2 className="mt-2 font-brand-heading text-3xl text-[color:var(--foreground)]">What species is this?</h2>

        {!showStats ? (
          <>
            <label
              htmlFor={`species-answer-${snippet.id}`}
              className="mb-2 mt-4 block text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]"
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
              className="mb-4 w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted)] focus:border-[color:var(--primary)]"
              style={{
                color: "var(--foreground)",
                WebkitTextFillColor: "var(--foreground)",
                caretColor: "var(--primary)",
              }}
            />
            <AnimatePresence>
              {correction && (
                <motion.div
                  key="correction"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mb-4 max-w-md rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4"
                >
                  <p className="text-sm text-[color:var(--muted)]">
                    Did you mean: <span className="font-semibold text-[color:var(--foreground)]">{correction.suggestion}</span>?
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <motion.button
                      type="button"
                      onClick={acceptCorrection}
                      whileTap={{ scale: 0.97 }}
                      className="pebl-button-primary rounded-full px-4 py-2 text-sm font-semibold"
                    >
                      Yes, use that
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={submitOriginal}
                      whileTap={{ scale: 0.97 }}
                      className="pebl-button-secondary rounded-full px-4 py-2 text-sm font-semibold"
                    >
                      Use my answer
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {submitError && (
              <p className="mb-4 text-sm font-medium text-red-700">{submitError}</p>
            )}
            <motion.button
              type="button"
              onClick={() => {
                void handleSubmit();
              }}
              disabled={!answerText.trim() || submitting}
              whileTap={!submitting && answerText.trim() ? { scale: 0.97 } : undefined}
              className="pebl-button-primary rounded-full px-6 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
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
              key={myAnswer.isCorrect ? "correct" : "wrong"}
              initial={myAnswer.isCorrect ? { scale: 0.9, opacity: 0 } : { x: 0 }}
              animate={
                myAnswer.isCorrect
                  ? { scale: 1, opacity: 1 }
                  : { x: [0, -10, 10, -8, 8, 0] }
              }
              transition={
                myAnswer.isCorrect
                  ? { type: "spring", stiffness: 300, damping: 20 }
                  : { duration: 0.4 }
              }
              className="mt-4 space-y-4"
            >
              <p className="font-medium text-[color:var(--primary)]">
                You said: {myAnswer.chosenOption}{" "}
                {myAnswer.isCorrect && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, delay: 0.1 }}
                  >
                    ✓ Correct!
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
                <p className="mt-2 text-sm text-[color:var(--muted)]">PEBL reference label: {stats.staffAnswer}</p>
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
