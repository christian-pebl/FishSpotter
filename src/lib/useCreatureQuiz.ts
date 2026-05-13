"use client";

import { useSession } from "next-auth/react";
import { useState, useCallback, useEffect } from "react";
import { playCorrect, playWrong, playStreak } from "@/lib/sounds";
import { triggerCorrectConfetti } from "@/lib/confetti";

interface SnippetForQuiz {
  id: string;
}

export interface TaxonSummary {
  id: string;
  name: string;
  scientificName: string | null;
  funFact: string | null;
  description: string | null;
  heroImageUrl: string | null;
  habitatNote: string | null;
  isFunctionalGroup: boolean;
}

export type AnswerOutcome = "correct" | "wrong" | "contributed" | "unrecognised";
export type LabelStatus = "STAFF_LABELLED" | "UNLABELLED";

export interface MyAnswer {
  chosenOption: string;
  isCorrect: boolean;
  outcome: AnswerOutcome | null;
  pointsAwarded: number;
  resolvedTaxon: TaxonSummary | null;
  staffTaxon: TaxonSummary | null;
  labelStatus: LabelStatus | null;
}

interface StatsItem {
  option: string;
  taxonId: string | null;
  count: number;
  percent: number;
}

interface Correction {
  original: string;
  suggestion: string;
}

interface SubmitOptions {
  answerText?: string;
  skipCorrection?: boolean;
}

let sharedBaselineStreak: number | null = null;

export function useCreatureQuiz(snippet: SnippetForQuiz, signInCallbackUrl?: string) {
  const { data: session, status } = useSession();
  const [myAnswer, setMyAnswer] = useState<MyAnswer | null>(null);
  const [stats, setStats] = useState<{
    total: number;
    stats: StatsItem[];
    staffAnswer: string;
    labelStatus: LabelStatus;
    staffTaxon: TaxonSummary | null;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [answerText, setAnswerTextState] = useState("");
  const [correction, setCorrection] = useState<Correction | null>(null);
  const [submitError, setSubmitError] = useState("");

  const loadMyAnswer = useCallback(async () => {
    const res = await fetch(`/api/answers/my?snippetId=${snippet.id}`);
    const data = await res.json();
    if (data.answer) {
      const labelStatus: LabelStatus | null = data.answer.labelStatus ?? null;
      const outcome: AnswerOutcome | null = data.answer.isCorrect
        ? "correct"
        : labelStatus === "UNLABELLED"
          ? "contributed"
          : labelStatus === "STAFF_LABELLED"
            ? "wrong"
            : null;
      setMyAnswer({
        chosenOption: data.answer.chosenOption,
        isCorrect: data.answer.isCorrect,
        outcome,
        pointsAwarded: data.answer.pointsAwarded ?? 0,
        resolvedTaxon: data.answer.resolvedTaxon ?? null,
        staffTaxon: data.answer.staffTaxon ?? null,
        labelStatus,
      });
    }
  }, [snippet.id]);

  const loadStats = useCallback(async () => {
    const res = await fetch(`/api/snippets/${snippet.id}/stats`);
    const data = await res.json();
    setStats(data);
  }, [snippet.id]);

  useEffect(() => {
    loadMyAnswer();
  }, [loadMyAnswer]);

  useEffect(() => {
    if (session?.user && sharedBaselineStreak === null) {
      fetch("/api/streak")
        .then((res) => res.json())
        .then((data) => {
          sharedBaselineStreak = data.currentStreak ?? 0;
        })
        .catch(() => {});
    }
  }, [session?.user]);

  useEffect(() => {
    if (myAnswer) loadStats();
  }, [myAnswer, loadStats]);

  const setAnswerText = useCallback((value: string) => {
    setAnswerTextState(value);
    setCorrection(null);
    setSubmitError("");
  }, []);

  const handleSubmit = useCallback(
    async (options?: SubmitOptions) => {
      if (!session?.user) {
        window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(
          signInCallbackUrl ?? `/feed/${snippet.id}`
        )}`;
        return false;
      }
      const option = (options?.answerText ?? answerText).trim();
      if (!option) return false;
      setSubmitting(true);
      setSubmitError("");
      try {
        const res = await fetch("/api/answers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            snippetId: snippet.id,
            chosenOption: option,
            skipCorrection: options?.skipCorrection ?? false,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setSubmitError(data.error ?? "Could not submit answer.");
          return false;
        }
        if (data.correction) {
          setCorrection(data.correction);
          return false;
        }
        if (data.answer) {
          const isCorrect = !!data.isCorrect;
          setMyAnswer({
            chosenOption: data.answer.chosenOption,
            isCorrect,
            outcome: data.outcome ?? null,
            pointsAwarded: data.pointsAwarded ?? 0,
            resolvedTaxon: data.resolvedTaxon ?? null,
            staffTaxon: data.staffTaxon ?? null,
            labelStatus: data.labelStatus ?? null,
          });
          setAnswerTextState(data.answer.chosenOption);
          setCorrection(null);
          if (isCorrect) {
            playCorrect();
            triggerCorrectConfetti();
          } else {
            playWrong();
          }
          const streakRes = await fetch("/api/streak");
          const streakData = await streakRes.json();
          const newStreak = streakData.currentStreak ?? 0;
          const prev = sharedBaselineStreak ?? 0;
          if (newStreak > prev) playStreak();
          sharedBaselineStreak = newStreak;
          window.dispatchEvent(new CustomEvent("fishspotter:streak"));
          await loadStats();
          return true;
        }
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [session?.user, answerText, snippet.id, signInCallbackUrl, loadStats]
  );

  const editAnswer = useCallback(() => {
    if (myAnswer) setAnswerTextState(myAnswer.chosenOption);
    setMyAnswer(null);
    setCorrection(null);
    setSubmitError("");
  }, [myAnswer]);

  const acceptCorrection = useCallback(async () => {
    if (!correction) return false;
    setAnswerTextState(correction.suggestion);
    return handleSubmit({ answerText: correction.suggestion, skipCorrection: true });
  }, [correction, handleSubmit]);

  const submitOriginal = useCallback(async () => {
    if (!correction) return false;
    setAnswerTextState(correction.original);
    return handleSubmit({ answerText: correction.original, skipCorrection: true });
  }, [correction, handleSubmit]);

  return {
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
    loadMyAnswer,
    loadStats,
  };
}
