"use client";

import { useSession } from "next-auth/react";
import { useState, useCallback, useEffect } from "react";
import { playCorrect, playWrong, playStreak } from "@/lib/sounds";
import { triggerCorrectConfetti } from "@/lib/confetti";

// S2-T04 killed the sharedBaselineStreak module global + the
// follow-up GET /api/streak after each submit. The streak diff is now
// returned inline from POST /api/answers, so deciding whether to play
// the streak sound is a comparison on the server-authoritative result
// (no race when several cards mount at once).

interface SnippetForQuiz {
  id: string;
}

interface StatsItem {
  option: string;
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

export function useCreatureQuiz(snippet: SnippetForQuiz, signInCallbackUrl?: string) {
  const { data: session, status } = useSession();
  const [myAnswer, setMyAnswer] = useState<{ chosenOption: string; isCorrect: boolean } | null>(null);
  // staffAnswer is gated server-side until the user has submitted an Answer for
  // this snippet (S1-T11). loadStats is only invoked after myAnswer is set
  // (see effect below), so in normal use it is always present at consumption,
  // but the type is optional to match the API contract.
  const [stats, setStats] = useState<{ total: number; stats: StatsItem[]; staffAnswer?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [answerText, setAnswerTextState] = useState("");
  const [correction, setCorrection] = useState<Correction | null>(null);
  const [submitError, setSubmitError] = useState("");

  const loadMyAnswer = useCallback(async () => {
    const res = await fetch(`/api/answers/my?snippetId=${snippet.id}`);
    const data = await res.json();
    if (data.answer) setMyAnswer({ chosenOption: data.answer.chosenOption, isCorrect: data.answer.isCorrect });
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
    if (myAnswer) loadStats();
  }, [myAnswer, loadStats]);

  const setAnswerText = useCallback((value: string) => {
    setAnswerTextState(value);
    setCorrection(null);
    setSubmitError("");
  }, []);

  const handleSubmit = useCallback(async (options?: SubmitOptions) => {
    if (!session?.user) {
      window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(signInCallbackUrl ?? `/feed/${snippet.id}`)}`;
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
        const isCorrect = data.answer.isCorrect;
        setMyAnswer({ chosenOption: data.answer.chosenOption, isCorrect });
        setAnswerTextState(data.answer.chosenOption);
        setCorrection(null);
        if (isCorrect) {
          playCorrect();
          triggerCorrectConfetti();
        } else {
          playWrong();
        }
        // S2-T04: server returns { previous, current } inline. Streak
        // sound fires exactly when the streak actually advanced.
        if (data.streak && data.streak.current > data.streak.previous) {
          playStreak();
        }
        window.dispatchEvent(new CustomEvent("fishspotter:streak"));
        await loadStats();
        return true;
      }
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [session?.user, answerText, snippet.id, signInCallbackUrl, loadStats]);

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

  // Flip back to the input view so the user can correct their previous answer.
  // The API route already upserts on (userId, snippetId), so a resubmit
  // replaces the stored answer without touching createdAt.
  const editAnswer = useCallback(() => {
    if (!myAnswer) return;
    setAnswerTextState(myAnswer.chosenOption);
    setMyAnswer(null);
    // Drop the stats card so the UI doesn't briefly show stale community
    // numbers next to the input — the next submit will reload them.
    setStats(null);
    setCorrection(null);
    setSubmitError("");
  }, [myAnswer]);

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
