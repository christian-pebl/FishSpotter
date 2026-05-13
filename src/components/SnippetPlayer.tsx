"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCreatureQuiz } from "@/lib/useCreatureQuiz";
import { TaxonRevealPanel } from "./TaxonRevealPanel";
import { IdGuideButton } from "./id-guide/IdGuideButton";
import { IdGuideSheet } from "./id-guide/IdGuideSheet";

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
    labelStatus: "STAFF_LABELLED" | "UNLABELLED";
  };
}

export function SnippetPlayer({ snippet }: SnippetPlayerProps) {
  const [guideOpen, setGuideOpen] = useState(false);
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
    editAnswer,
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
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">Spotter challenge</p>
          {snippet.labelStatus === "UNLABELLED" ? (
            <span className="rounded-full border border-orange-400/50 bg-orange-400/15 px-2 py-0.5 text-[10px] font-semibold text-orange-600">
              🟠 Help us ID · +5
            </span>
          ) : (
            <span className="rounded-full border border-[color:var(--primary)]/40 bg-[color:var(--primary)]/10 px-2 py-0.5 text-[10px] font-semibold text-[color:var(--primary)]">
              🟢 Verified
            </span>
          )}
        </div>
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
            {!correction && (
              <div className="mt-3">
                <IdGuideButton onClick={() => setGuideOpen(true)} />
              </div>
            )}
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
            <div className="mt-4 rounded-2xl bg-[#17252A] p-4 text-white">
              <TaxonRevealPanel
                myAnswer={myAnswer}
                stats={stats}
                hasNext={false}
                onAdvance={() => {}}
                onEdit={editAnswer}
              />
            </div>
          </AnimatePresence>
        )}
      </div>
      <IdGuideSheet
        open={guideOpen}
        snippetId={snippet.id}
        onClose={() => setGuideOpen(false)}
        onConfirm={(taxonName) => {
          setGuideOpen(false);
          setAnswerText(taxonName);
          void handleSubmit({ answerText: taxonName, skipCorrection: true });
        }}
      />
    </div>
  );
}
