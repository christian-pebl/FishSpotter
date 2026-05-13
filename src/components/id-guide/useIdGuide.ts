"use client";

import { useReducer, useMemo, useCallback, useEffect, useRef } from "react";
import {
  QUESTIONS,
  visibleQuestions,
  type Answers,
  type Question,
  type QuestionKey,
} from "@/lib/id-guide-questions";
import type { TaxonSummary } from "@/lib/useCreatureQuiz";

// ─── Types ───────────────────────────────────────────────────────────────────

export type LocalStatus = "common" | "occasional" | "uncommon" | "no_data";

export interface Candidate {
  taxon: TaxonSummary;
  matchScore: number;
  priorScore: number;
  finalScore: number;
  matchReasons: string[];
  /** Locality-of-occurrence label, derived from OBIS prior. Undefined for older API responses. */
  localStatus?: LocalStatus;
  localRecords?: number;
}

export type IdGuideStage = "questions" | "loading" | "results" | "noMatch" | "error";

export interface IdGuideState {
  stage: IdGuideStage;
  /** Index into the *visible* question list for the current `answers`. */
  questionIndex: number;
  answers: Answers;
  candidates: Candidate[];
  errorMessage: string | null;
}

// ─── Pure reducer (unit-testable) ────────────────────────────────────────────

export type IdGuideAction =
  | { type: "answer"; key: QuestionKey; value: string }
  | { type: "skip" }
  | { type: "back" }
  | { type: "goToResults" } // user wants to finish early
  | { type: "loading" }
  | { type: "results"; candidates: Candidate[] }
  | { type: "noMatch" }
  | { type: "error"; message: string }
  | { type: "reject" } // from results back to last question
  | { type: "reset" };

export const initialState: IdGuideState = {
  stage: "questions",
  questionIndex: 0,
  answers: {},
  candidates: [],
  errorMessage: null,
};

/**
 * Build an initial state. Note: any `prefill` provided to the hook is rendered as a
 * *suggestion* (highlighted option + "we've spotted" hint) — it's NOT seeded into
 * `answers`. The user must explicitly tap to confirm. This keeps the funnel honest
 * and makes the back button + skip semantics simple.
 */
export function initState(): IdGuideState {
  return initialState;
}

export function reducer(state: IdGuideState, action: IdGuideAction): IdGuideState {
  switch (action.type) {
    case "answer": {
      const nextAnswers: Answers = { ...state.answers, [action.key]: action.value };
      const visible = visibleQuestions(nextAnswers);
      const nextIndex = state.questionIndex + 1;
      // If we just answered the last visible question, hand off to the caller to submit
      if (nextIndex >= visible.length) {
        return { ...state, answers: nextAnswers, stage: "loading", errorMessage: null };
      }
      return {
        ...state,
        answers: nextAnswers,
        questionIndex: nextIndex,
        errorMessage: null,
      };
    }

    case "skip": {
      const visible = visibleQuestions(state.answers);
      const nextIndex = state.questionIndex + 1;
      if (nextIndex >= visible.length) {
        return { ...state, stage: "loading", errorMessage: null };
      }
      return { ...state, questionIndex: nextIndex, errorMessage: null };
    }

    case "back": {
      if (state.questionIndex === 0) return state;
      // Drop the answer for the question we're navigating back to (so the user can re-pick)
      const visibleNow = visibleQuestions(state.answers);
      const prevIndex = state.questionIndex - 1;
      const prevKey = visibleNow[prevIndex]?.key;
      const nextAnswers: Answers = { ...state.answers };
      if (prevKey) delete nextAnswers[prevKey];
      return {
        ...state,
        questionIndex: prevIndex,
        answers: nextAnswers,
        stage: "questions",
        errorMessage: null,
      };
    }

    case "goToResults":
      return { ...state, stage: "loading", errorMessage: null };

    case "loading":
      return { ...state, stage: "loading", errorMessage: null };

    case "results":
      return {
        ...state,
        stage: action.candidates.length === 0 ? "noMatch" : "results",
        candidates: action.candidates,
        errorMessage: null,
      };

    case "noMatch":
      return { ...state, stage: "noMatch", candidates: [], errorMessage: null };

    case "error":
      return { ...state, stage: "error", errorMessage: action.message };

    case "reject": {
      // Drop back to the last *answered* question so the user can adjust
      const visible = visibleQuestions(state.answers);
      const idx = Math.max(0, Math.min(visible.length - 1, state.questionIndex));
      return { ...state, stage: "questions", questionIndex: idx, candidates: [], errorMessage: null };
    }

    case "reset":
      return initState();

    default:
      return state;
  }
}

// ─── React hook (wires reducer to /api/id-guide/match) ───────────────────────

export interface UseIdGuideOpts {
  snippetId: string;
  prefill?: Answers;
  /** Called when the user confirms a candidate. The parent fills the input + submits. */
  onConfirm: (taxonName: string) => void;
  /** Called on bail / Type instead. The parent closes the sheet. */
  onBail?: () => void;
}

export function useIdGuide({ snippetId, prefill, onConfirm, onBail }: UseIdGuideOpts) {
  const [state, dispatch] = useReducer(reducer, undefined, initState);

  // Track ongoing match request to avoid stale resolves
  const requestSeqRef = useRef(0);

  const visible = useMemo(() => visibleQuestions(state.answers), [state.answers]);
  const currentQuestion: Question | null = visible[state.questionIndex] ?? null;

  // Fire the API call when we transition into `loading`
  useEffect(() => {
    if (state.stage !== "loading") return;
    const seq = ++requestSeqRef.current;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/id-guide/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snippetId, answers: state.answers }),
        });
        const body = await res.json().catch(() => ({}));
        if (cancelled || requestSeqRef.current !== seq) return;
        if (!res.ok) {
          dispatch({ type: "error", message: body?.error ?? "Couldn't fetch matches." });
          return;
        }
        const candidates: Candidate[] = body?.candidates ?? [];
        dispatch({ type: "results", candidates });
      } catch (e) {
        if (cancelled) return;
        dispatch({
          type: "error",
          message: e instanceof Error ? e.message : "Network error.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state.stage, state.answers, snippetId]);

  const answer = useCallback((key: QuestionKey, value: string) => {
    dispatch({ type: "answer", key, value });
  }, []);
  const skip = useCallback(() => dispatch({ type: "skip" }), []);
  const back = useCallback(() => dispatch({ type: "back" }), []);
  const goToResults = useCallback(() => dispatch({ type: "goToResults" }), []);
  const reject = useCallback(() => dispatch({ type: "reject" }), []);
  const reset = useCallback(() => dispatch({ type: "reset" }), []);
  const selectCandidate = useCallback(
    (taxonName: string) => onConfirm(taxonName),
    [onConfirm],
  );
  const bail = useCallback(() => onBail?.(), [onBail]);

  return {
    state,
    visibleQuestions: visible,
    currentQuestion,
    totalQuestions: visible.length,
    answer,
    skip,
    back,
    goToResults,
    reject,
    reset,
    selectCandidate,
    bail,
  };
}

// Re-exports so callers don't need to know about id-guide-questions
export { QUESTIONS };
