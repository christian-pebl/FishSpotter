"use client";

import { useSession } from "next-auth/react";
import { useState, useCallback, useEffect, useRef } from "react";
import { playCorrect, playWrong, playStreak } from "@/lib/sounds";
import { triggerCorrectConfetti } from "@/lib/confetti";

// S2-T04 killed the sharedBaselineStreak module global + the
// follow-up GET /api/streak after each submit. The streak diff is now
// returned inline from POST /api/answers, so deciding whether to play
// the streak sound is a comparison on the server-authoritative result
// (no race when several cards mount at once).

// S2-T10: shared sessionStorage key for the anonymous-answer carry.
// Anonymous user picks a candidate (or types one) → we stash the
// {snippetId, chosenOption} here and bounce them to /auth/signin. On
// return to /feed, useCreatureQuiz checks if the stash matches the
// currently-mounted snippet and auto-submits. Cleared after one shot.
const PENDING_ANSWER_KEY = "fishspotter:pendingAnswer";

const PENDING_ANSWER_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface PendingAnswer {
  snippetId: string;
  chosenOption: string;
  timestamp?: number;
}

function readPendingAnswer(): PendingAnswer | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_ANSWER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingAnswer>;
    if (
      typeof parsed?.snippetId === "string" &&
      typeof parsed?.chosenOption === "string"
    ) {
      // Drop stale entries (older than 24 h).
      if (
        typeof parsed.timestamp === "number" &&
        Date.now() - parsed.timestamp > PENDING_ANSWER_MAX_AGE_MS
      ) {
        window.sessionStorage.removeItem(PENDING_ANSWER_KEY);
        return null;
      }
      return { snippetId: parsed.snippetId, chosenOption: parsed.chosenOption, timestamp: parsed.timestamp };
    }
  } catch {
    // Ignore malformed values; we'll just skip the carry.
  }
  return null;
}

function clearPendingAnswer(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PENDING_ANSWER_KEY);
  } catch {
    // ignore
  }
}

function stashPendingAnswer(snippetId: string, chosenOption: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      PENDING_ANSWER_KEY,
      JSON.stringify({ snippetId, chosenOption, timestamp: Date.now() }),
    );
  } catch {
    // ignore — non-essential
  }
}

interface SnippetForQuiz {
  id: string;
}

interface StatsItem {
  option: string;
  count: number;
  percent: number;
}

interface SubmitOptions {
  answerText?: string;
}

export function useCreatureQuiz(snippet: SnippetForQuiz, signInCallbackUrl?: string) {
  const { data: session, status } = useSession();
  // S7-T1: isCorrect is null when the snippet has no reference identification
  // yet — the user earns a flat participation bonus regardless of their guess.
  // points is the per-row score the server awarded (2 correct, 1 pending,
  // 0 incorrect — see lib/answer-matching POINTS_*).
  const [myAnswer, setMyAnswer] = useState<{
    chosenOption: string;
    isCorrect: boolean | null;
    points: number;
  } | null>(null);
  // staffAnswer is gated server-side until the user has submitted an Answer for
  // this snippet (S1-T11). loadStats is only invoked after myAnswer is set
  // (see effect below), so in normal use it is always present at consumption,
  // but the type is optional to match the API contract.
  // S7-T1: staffAnswer may be null when the snippet has no reference yet;
  // hasReference is a convenience flag the server includes alongside.
  const [stats, setStats] = useState<{
    total: number;
    stats: StatsItem[];
    staffAnswer?: string | null;
    hasReference?: boolean;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [answerText, setAnswerTextState] = useState("");
  const [submitError, setSubmitError] = useState("");

  // S2-T09: dedupe celebration effects (confetti + correct sound). One
  // burst per (user, snippet) per session, regardless of edit-resubmit
  // or RarityPanel's rare-find tier. RarityPanel's second-fire was
  // removed in the same ticket.
  const celebratedSnippetIds = useRef<Set<string>>(new Set());
  // S2-T09: callback the parent supplies so editAnswer can refocus the
  // free-text input (DEGENERATE / error fallback only). With the MCQ
  // picker active, the focus is a no-op when there's no input mounted.
  const editFocusRef = useRef<(() => void) | null>(null);
  const setEditFocusCallback = useCallback((fn: (() => void) | null) => {
    editFocusRef.current = fn;
  }, []);

  const loadMyAnswer = useCallback(async () => {
    const res = await fetch(`/api/answers/my?snippetId=${snippet.id}`);
    const data = await res.json();
    if (data.answer)
      setMyAnswer({
        chosenOption: data.answer.chosenOption,
        isCorrect: data.answer.isCorrect ?? null,
        points: data.answer.points ?? 0,
      });
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

  // S2-T10: rehydrate the pending anonymous answer on return from
  // signin. The carry is consumed exactly once — even if the user
  // navigates to a different snippet first, we drop the stash so we
  // don't auto-submit on the wrong card later.
  const rehydratedRef = useRef(false);
  useEffect(() => {
    if (rehydratedRef.current) return;
    if (!session?.user?.id) return;
    if (myAnswer) {
      // Already answered (server has a row) — drop any stale stash
      // so it doesn't fire later on a different mount.
      clearPendingAnswer();
      rehydratedRef.current = true;
      return;
    }
    const pending = readPendingAnswer();
    if (!pending) {
      rehydratedRef.current = true;
      return;
    }
    if (pending.snippetId !== snippet.id) {
      // Mismatch — leave the stash in place. The matching card mount
      // will consume it.
      return;
    }
    // Consume immediately so a slow submit doesn't race a second mount.
    clearPendingAnswer();
    rehydratedRef.current = true;
    void handleSubmit({ answerText: pending.chosenOption });
    // handleSubmit is intentionally not a dep — referencing it here
    // would re-run the effect on every render thanks to useCallback's
    // identity churn (session changes, answerText changes, etc.).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, myAnswer, snippet.id]);

  const setAnswerText = useCallback((value: string) => {
    setAnswerTextState(value);
    setSubmitError("");
  }, []);

  const handleSubmit = useCallback(async (options?: SubmitOptions) => {
    if (!session?.user) {
      // S2-T10: stash the typed/tapped answer so it survives the signin
      // round-trip. Callback URL forces them back to the same snippet
      // so the auto-submit on return targets the right card.
      const pendingOption = (options?.answerText ?? answerText).trim();
      if (pendingOption) {
        stashPendingAnswer(snippet.id, pendingOption);
      }
      const target = signInCallbackUrl ?? `/feed/${snippet.id}`;
      // A first-time spotter who just submitted an ID almost never has an
      // account yet, so default the bounce to the sign-UP form (the page has a
      // toggle for returning users who signed out). Avoids landing newcomers on
      // a password sign-in for an account that does not exist.
      window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(target)}&isSignUp=1`;
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
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Could not submit answer.");
        return false;
      }
      if (data.answer) {
        const isCorrect: boolean | null = data.answer.isCorrect ?? null;
        const points: number = data.answer.points ?? 0;
        setMyAnswer({
          chosenOption: data.answer.chosenOption,
          isCorrect,
          points,
        });
        setAnswerTextState(data.answer.chosenOption);
        if (isCorrect === true) {
          // S2-T09: celebrate once per (user, snippet) per session.
          // Edit-then-resubmit on the same snippet is silent. Rare-find
          // upgrades the visual but doesn't stack a second burst (the
          // RarityPanel second-fire is gone in the same ticket).
          if (!celebratedSnippetIds.current.has(snippet.id)) {
            celebratedSnippetIds.current.add(snippet.id);
            playCorrect();
            triggerCorrectConfetti();
          }
        } else if (isCorrect === false && points === 0) {
          // Only a true miss buzzes. A shape-class partial credit (points > 0,
          // "Spot It" Workstream E) is encouraging, not an error, so it stays
          // silent — the reveal's "Close · +1" pill carries the signal.
          playWrong();
        }
        // S7-T1: when isCorrect is null (no reference yet) the submission
        // is a "pending bonus" — no celebration audio (it isn't a verified
        // correct answer) and no wrong buzz (the user didn't actually
        // miss). The +1 chip on the reveal carries the signal.
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
    setSubmitError("");
    // S2-T09: refocus the input when the parent provides a focus
    // callback. With the MCQ picker active and no DEGENERATE
    // fallback rendered, editFocusRef is null and this is a no-op.
    if (editFocusRef.current) {
      requestAnimationFrame(() => editFocusRef.current?.());
    }
  }, [myAnswer]);

  return {
    session,
    status,
    myAnswer,
    stats,
    submitting,
    answerText,
    setAnswerText,
    submitError,
    handleSubmit,
    editAnswer,
    loadMyAnswer,
    loadStats,
    setEditFocusCallback,
  };
}
