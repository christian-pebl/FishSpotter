"use client";

import { motion } from "framer-motion";
import type { Question, QuestionKey, Option, Answers } from "@/lib/id-guide-questions";

interface Props {
  question: Question;
  answers: Answers;
  /** Value pre-suggested by smart-prefill (e.g. derived from bbox). Highlighted with a hint. */
  prefillSuggestion?: string;
  onAnswer: (key: QuestionKey, value: string) => void;
  onSkip?: () => void;
}

export function IdGuideQuestion({
  question,
  answers,
  prefillSuggestion,
  onAnswer,
  onSkip,
}: Props) {
  // Resolve options (Q4 varies by Q1 answer)
  const options: Option[] =
    typeof question.optionsFor === "function" ? question.optionsFor(answers) : question.options;

  const selectedValue = answers[question.key];

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-brand-heading text-xl text-white sm:text-2xl">{question.prompt}</h2>

      {prefillSuggestion && !selectedValue && (
        <p className="-mt-2 text-xs text-[#DEF2F1]">
          We&apos;ve spotted: <span className="font-semibold">{
            options.find((o) => o.value === prefillSuggestion)?.label ?? prefillSuggestion
          }</span> — tap to confirm or pick a different one.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((opt) => {
          const isSelected = selectedValue === opt.value;
          const isPrefill = !selectedValue && prefillSuggestion === opt.value;
          return (
            <motion.button
              key={opt.value}
              type="button"
              onClick={() => onAnswer(question.key, opt.value)}
              whileTap={{ scale: 0.96 }}
              aria-pressed={isSelected}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-3 py-4 text-sm font-medium transition-colors min-h-[88px] ${
                isSelected
                  ? "border-[#3AAFA9] bg-[#3AAFA9]/15 text-white"
                  : isPrefill
                    ? "border-[#DEF2F1] bg-[#DEF2F1]/10 text-white ring-2 ring-[#DEF2F1]/40"
                    : "border-white/12 bg-white/[0.04] text-white/85 hover:border-white/30 hover:bg-white/[0.08]"
              }`}
            >
              <span className="text-2xl leading-none" aria-hidden>{opt.emoji}</span>
              <span className="text-center text-xs leading-tight sm:text-sm">{opt.label}</span>
            </motion.button>
          );
        })}
      </div>

      {question.optional && onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="self-center text-xs text-white/55 underline underline-offset-4 hover:text-white/80"
        >
          Skip this question
        </button>
      )}
    </div>
  );
}
