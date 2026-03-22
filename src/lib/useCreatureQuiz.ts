"use client";

import { useSession } from "next-auth/react";
import { useState, useCallback, useEffect, useRef } from "react";
import { playCorrect, playWrong, playStreak } from "@/lib/sounds";

interface SnippetForQuiz {
  id: string;
}

interface StatsItem {
  option: string;
  count: number;
  percent: number;
}

export function useCreatureQuiz(snippet: SnippetForQuiz, signInCallbackUrl?: string) {
  const { data: session, status } = useSession();
  const [myAnswer, setMyAnswer] = useState<{ chosenOption: string; isCorrect: boolean } | null>(null);
  const [stats, setStats] = useState<{ total: number; stats: StatsItem[]; staffAnswer: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState("");
  const [otherText, setOtherText] = useState("");
  const previousStreakRef = useRef<number | null>(null);

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
    if (session?.user) {
      fetch("/api/streak")
        .then((res) => res.json())
        .then((data) => {
          previousStreakRef.current = data.currentStreak ?? 0;
        })
        .catch(() => {});
    }
  }, [session?.user]);

  useEffect(() => {
    if (myAnswer) loadStats();
  }, [myAnswer, loadStats]);

  const handleSubmit = useCallback(async () => {
    if (!session?.user) {
      window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(signInCallbackUrl ?? `/feed/${snippet.id}`)}`;
      return;
    }
    if (!selected) return;
    const option = selected;
    const freeTextValue = selected === "Other" ? otherText.trim() : undefined;
    setSubmitting(true);
    try {
      const res = await fetch("/api/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snippetId: snippet.id,
          chosenOption: option,
          freeText: freeTextValue,
        }),
      });
      const data = await res.json();
      if (data.answer) {
        const isCorrect = data.answer.isCorrect;
        setMyAnswer({ chosenOption: data.answer.chosenOption, isCorrect });
        if (isCorrect) playCorrect();
        else playWrong();
        const streakRes = await fetch("/api/streak");
        const streakData = await streakRes.json();
        const newStreak = streakData.currentStreak ?? 0;
        const prev = previousStreakRef.current ?? 0;
        if (newStreak > prev) playStreak();
        previousStreakRef.current = newStreak;
        window.dispatchEvent(new CustomEvent("fishspotter:streak"));
        await loadStats();
      }
    } finally {
      setSubmitting(false);
    }
  }, [session?.user, selected, otherText, snippet.id, signInCallbackUrl, loadStats]);

  return {
    session,
    status,
    myAnswer,
    stats,
    submitting,
    selected,
    setSelected,
    otherText,
    setOtherText,
    handleSubmit,
    loadMyAnswer,
    loadStats,
  };
}
