"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useIdGuide } from "./useIdGuide";
import { IdGuideStepIndicator } from "./IdGuideStepIndicator";
import { IdGuideQuestion } from "./IdGuideQuestion";
import { IdGuideResults } from "./IdGuideResults";
import type { Answers } from "@/lib/id-guide-questions";

interface Props {
  open: boolean;
  snippetId: string;
  prefill?: Answers;
  /** Called when user confirms a candidate; the host fills the input + submits. */
  onConfirm: (taxonName: string) => void;
  /** Called when the user wants to type instead, or closes the sheet. */
  onClose: () => void;
}

export function IdGuideSheet({ open, snippetId, prefill, onConfirm, onClose }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);

  const guide = useIdGuide({
    snippetId,
    prefill,
    onConfirm: (name) => {
      onConfirm(name);
    },
    onBail: onClose,
  });

  // Reset whenever the sheet opens (so closing then reopening starts fresh)
  useEffect(() => {
    if (open) guide.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Focus the sheet on open for keyboard users
  useEffect(() => {
    if (open) sheetRef.current?.focus();
  }, [open]);

  const { state, currentQuestion, totalQuestions, answer, skip, back, reject, selectCandidate, bail } = guide;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="id-guide-backdrop"
          className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close ID guide"
            onClick={onClose}
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
          />

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Help me figure it out"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="relative z-10 flex max-h-[90vh] w-full flex-col gap-4 overflow-y-auto rounded-t-3xl bg-[#17252A] p-5 text-white shadow-2xl sm:max-h-[85vh] sm:w-[480px] sm:rounded-3xl"
          >
            {/* Header — back arrow + step indicator + Type instead */}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={state.stage === "questions" ? back : reject}
                disabled={state.stage === "questions" && state.questionIndex === 0}
                className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Back"
              >
                ←
              </button>

              {state.stage === "questions" && totalQuestions > 0 && (
                <IdGuideStepIndicator
                  current={state.questionIndex}
                  total={totalQuestions}
                  label={`Q${state.questionIndex + 1} of ${totalQuestions}`}
                />
              )}

              <button
                type="button"
                onClick={bail}
                className="text-xs text-[#DEF2F1] underline underline-offset-4 hover:text-white"
              >
                Type instead
              </button>
            </div>

            {/* Body */}
            <div className="flex-1">
              {state.stage === "questions" && currentQuestion && (
                <IdGuideQuestion
                  question={currentQuestion}
                  answers={state.answers}
                  prefillSuggestion={prefill?.[currentQuestion.key]}
                  onAnswer={answer}
                  onSkip={currentQuestion.optional ? skip : undefined}
                />
              )}

              {state.stage === "loading" && (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#3AAFA9] border-t-transparent" />
                  <p className="text-sm text-white/75">Searching for matches…</p>
                </div>
              )}

              {state.stage === "results" && (
                <IdGuideResults
                  candidates={state.candidates}
                  onConfirm={selectCandidate}
                  onReject={reject}
                  onBail={bail}
                />
              )}

              {state.stage === "noMatch" && (
                <IdGuideResults
                  candidates={[]}
                  onConfirm={selectCandidate}
                  onReject={reject}
                  onBail={bail}
                />
              )}

              {state.stage === "error" && (
                <div className="flex flex-col gap-3 text-center">
                  <p className="text-sm text-orange-300">{state.errorMessage ?? "Something went wrong."}</p>
                  <button
                    type="button"
                    onClick={reject}
                    className="self-center rounded-full border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:border-[#3AAFA9]"
                  >
                    ← Adjust answers
                  </button>
                </div>
              )}
            </div>

            {/* Footer — bail/skip-clip option always available */}
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-white/55 underline underline-offset-4 hover:text-white/80"
              >
                Skip this clip
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
