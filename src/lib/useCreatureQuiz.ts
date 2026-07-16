"use client";

import { useSession } from "next-auth/react";
import { useState, useCallback, useEffect, useRef } from "react";
import { playCorrect, playWrong, playStreak } from "@/lib/sounds";
import { triggerCorrectConfetti } from "@/lib/confetti";
import { emitPebbles } from "@/lib/pebble-bus";
import { getMyAnswer, setMyAnswer as cacheMyAnswer } from "@/lib/myAnswers";
import { GUEST_SAVE_PROMPT_AT, GUEST_MILESTONE_EVENT } from "@/lib/guest";

// S2-T04 killed the sharedBaselineStreak module global + the
// follow-up GET /api/streak after each submit. The streak diff is now
// returned inline from POST /api/answers, so deciding whether to play
// the streak sound is a comparison on the server-authoritative result
// (no race when several cards mount at once).

// P0 "play before the wall": signed-out spotters now get the REAL reveal
// locally (via the read-only /api/answers/preview), instead of being bounced to
// signup on their first guess. Every guest guess is queued here so that, when
// they DO sign up, all of them are carried in and persisted (this replaces the
// old single-answer S2-T10 sessionStorage stash). localStorage so the queue
// survives a tab close and a return within the day.
const GUEST_QUEUE_KEY = "fishspotter:guestAnswers";
const GUEST_ANSWER_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const GUEST_QUEUE_MAX = 50; // cap so a long guest run can't bloat storage

interface PendingAnswer {
  snippetId: string;
  chosenOption: string;
  timestamp: number;
}

function readGuestQueue(): PendingAnswer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GUEST_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.filter(
      (e): e is PendingAnswer =>
        !!e &&
        typeof e.snippetId === "string" &&
        typeof e.chosenOption === "string" &&
        typeof e.timestamp === "number" &&
        now - e.timestamp <= GUEST_ANSWER_MAX_AGE_MS,
    );
  } catch {
    // Ignore malformed values; we'll just skip the carry.
    return [];
  }
}

function writeGuestQueue(list: PendingAnswer[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      GUEST_QUEUE_KEY,
      JSON.stringify(list.slice(-GUEST_QUEUE_MAX)),
    );
  } catch {
    // ignore — non-essential
  }
}

// Add (or replace) the guess for a snippet; returns the new queue length so the
// caller can drive the "save your N finds" nudge.
function pushGuestAnswer(snippetId: string, chosenOption: string): number {
  const list = readGuestQueue().filter((e) => e.snippetId !== snippetId);
  list.push({ snippetId, chosenOption, timestamp: Date.now() });
  writeGuestQueue(list);
  return Math.min(list.length, GUEST_QUEUE_MAX);
}

function guestAnswerFor(snippetId: string): PendingAnswer | null {
  return readGuestQueue().find((e) => e.snippetId === snippetId) ?? null;
}

function removeGuestAnswer(snippetId: string): void {
  writeGuestQueue(readGuestQueue().filter((e) => e.snippetId !== snippetId));
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
  // T-07: reward progress from the authed answer response (streak + collection
  // unlock), surfaced on the reveal at the moment of the win. Null for guests.
  const [rewardProgress, setRewardProgress] = useState<{
    streakCurrent: number;
    streakAdvanced: boolean;
    unlock: { isNew: boolean; commonName: string; collectionCount: number } | null;
    pebblesEarned: number;
    firstSighting: boolean;
  } | null>(null);
  // P0: how many clips this signed-out spotter has played (drives the "save
  // your finds" nudge). Seeded from the persisted guest queue on mount.
  const [guestAnswerCount, setGuestAnswerCount] = useState(0);
  useEffect(() => {
    setGuestAnswerCount(readGuestQueue().length);
  }, []);
  // Sign-up link for the guest nudge — returns to the feed so the queued
  // guesses drain and persist on arrival.
  const signUpHref = `/auth/signin?isSignUp=1&callbackUrl=${encodeURIComponent(
    signInCallbackUrl ?? "/feed",
  )}`;

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

  const userId = session?.user?.id ?? null;
  const loadMyAnswer = useCallback(async () => {
    // Guests have no persisted answers — skip the fetch entirely. Only signed-in
    // cards load, and they share ONE coalesced /api/answers/my call across the
    // whole feed (see @/lib/myAnswers) rather than one request per card.
    if (!userId) return;
    try {
      const answer = await getMyAnswer(userId, snippet.id);
      if (answer) setMyAnswer(answer);
    } catch {
      // Transient failure: leave myAnswer unset so the user can still answer.
    }
  }, [snippet.id, userId]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/snippets/${snippet.id}/stats`);
      if (!res.ok) throw new Error(`stats ${res.status}`);
      const data = await res.json();
      setStats(data);
    } catch {
      // Don't strand the reveal on an infinite "Scoring your answer…" spinner
      // if the stats fetch blips (transient 500 / timeout). Fall back to an
      // empty community breakdown so the result still renders; the user keeps
      // their score (myAnswer / rewardProgress drive the reveal regardless).
      setStats({ total: 0, stats: [] });
    }
  }, [snippet.id]);

  useEffect(() => {
    loadMyAnswer();
  }, [loadMyAnswer]);

  useEffect(() => {
    if (myAnswer) loadStats();
  }, [myAnswer, loadStats]);

  // P0: on auth, carry in the guest guess for THIS snippet — submit it via the
  // authed path so it's persisted + scored, then drop it from the queue. Each
  // mounted card drains its own entry, so a whole guest session is backfilled.
  // (Once the feed windows cards — P2 — a central drain on auth would be more
  // robust; today every card mounts so per-card draining covers the queue.)
  const rehydratedRef = useRef(false);
  useEffect(() => {
    if (rehydratedRef.current) return;
    if (!session?.user?.id) return;
    if (myAnswer) {
      // Already persisted — drop any stale queued guess for this snippet.
      removeGuestAnswer(snippet.id);
      rehydratedRef.current = true;
      return;
    }
    const pending = guestAnswerFor(snippet.id);
    if (!pending) {
      rehydratedRef.current = true;
      return;
    }
    // Consume immediately so a slow submit doesn't race a second mount.
    removeGuestAnswer(snippet.id);
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
    // Wait for the session to resolve so a submit in the brief loading window
    // isn't mis-routed (guest preview vs authed persist).
    if (status === "loading") return false;

    const option = (options?.answerText ?? answerText).trim();
    if (!option) return false;

    // P0 "play before the wall": a signed-out spotter gets the REAL reveal
    // locally — graded by the public, read-only /api/answers/preview (no DB
    // write) — and the guess is queued for carry-in on signup. No bounce: the
    // reward lands before we ever ask for an account.
    if (!session?.user) {
      setSubmitting(true);
      setSubmitError("");
      try {
        const res = await fetch("/api/answers/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snippetId: snippet.id, chosenOption: option }),
        });
        const data = await res.json();
        if (!res.ok) {
          setSubmitError(data.error ?? "Could not check that answer.");
          return false;
        }
        const isCorrect: boolean | null = data.isCorrect ?? null;
        const points: number = data.points ?? 0;
        setMyAnswer({ chosenOption: option, isCorrect, points });
        // Guests don't get the per-user-gated stats route (no Answer row), so
        // the preview response carries the full reveal payload directly.
        setStats({
          total: data.total ?? 0,
          stats: data.stats ?? [],
          staffAnswer: data.staffAnswer ?? null,
          hasReference: data.hasReference ?? false,
        });
        setAnswerTextState(option);
        if (isCorrect === true) {
          if (!celebratedSnippetIds.current.has(snippet.id)) {
            celebratedSnippetIds.current.add(snippet.id);
            playCorrect();
            triggerCorrectConfetti();
          }
        } else if (isCorrect === false && points === 0) {
          playWrong();
        }
        setGuestAnswerCount(pushGuestAnswer(snippet.id, option));
        return true;
      } finally {
        setSubmitting(false);
      }
    }

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
        const answer = {
          chosenOption: data.answer.chosenOption,
          isCorrect,
          points,
        };
        setMyAnswer(answer);
        // Keep the shared answer cache in step so a remount of this card reads
        // the submitted answer instead of re-fetching the whole set.
        if (userId) cacheMyAnswer(userId, snippet.id, answer);
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
        // T-07: capture the progress so the reveal can land it at the win.
        setRewardProgress({
          streakCurrent: data.streak?.current ?? 0,
          streakAdvanced: !!(data.streak && data.streak.current > data.streak.previous),
          unlock: data.unlock ?? null,
          pebblesEarned: data.pebbles?.earned ?? 0,
          firstSighting: data.pebbles?.firstSighting ?? false,
        });
        // Sea-currency redesign: tell the header's Pebble bag to collect the
        // freshly-earned pebbles and sync the running total. `earned` is 0 on a
        // re-guess (the original award is locked), so the bag stays still then.
        if (data.pebbles) {
          emitPebbles({
            earned: data.pebbles.earned ?? 0,
            total: data.pebbles.total ?? 0,
            firstSighting: data.pebbles.firstSighting ?? false,
          });
        }
        // Zero-friction guest flow: once a username-only guest has spotted
        // GUEST_SAVE_PROMPT_AT clips, nudge them to save with an email. The
        // GuestSavePrompt listens for this; it decides whether to actually show.
        if (
          (session?.user as { isGuest?: boolean } | undefined)?.isGuest &&
          (data.answerCount ?? 0) >= GUEST_SAVE_PROMPT_AT
        ) {
          window.dispatchEvent(
            new CustomEvent(GUEST_MILESTONE_EVENT, {
              detail: { count: data.answerCount },
            }),
          );
        }
        window.dispatchEvent(new CustomEvent("fishspotter:streak"));
        await loadStats();
        return true;
      }
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [status, session?.user, userId, answerText, snippet.id, loadStats]);

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
    setRewardProgress(null);
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
    guestAnswerCount,
    signUpHref,
    rewardProgress,
  };
}
