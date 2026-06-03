"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type {
  QuizCandidate,
  SelectionFallback,
} from "@/lib/biodiversity/candidates";

/**
 * MCQ candidate picker for the /feed quiz panel (S2-T14).
 *
 * Fetches `/api/snippets/[id]/quiz` when mounted, then renders a 2-up
 * (mobile) / 4-up (desktop) grid of candidate buttons with thumbnails.
 * Click a button → calls `onPick(candidate.commonName)`, which the
 * parent forwards to `useCreatureQuiz.handleSubmit({ answerText })`.
 *
 * Three fallback paths from S2-T05/T06 are honoured (S2-T07):
 *   - "OBIS"       — straightforward MCQ
 *   - "CATALOGUE"  — MCQ + microcopy "candidates drawn from catalogue"
 *   - "DEGENERATE" — render `freeTextFallback` instead (parent passes
 *                    the legacy input). Caller sees the fallback flag
 *                    via `onFallback` and decides what to show.
 *
 * Unsigned users still see the same MCQ buttons; clicking them goes
 * through the parent's submit path which already redirects unauth to
 * /auth/signin with the typed answer carried via the existing
 * callback (S2-T10 will tighten this further with sessionStorage).
 */
export function MCQCandidatePicker({
  snippetId,
  isSignedIn,
  submitting,
  onPick,
  onFallback,
  freeTextFallback,
}: {
  snippetId: string;
  isSignedIn: boolean;
  submitting: boolean;
  onPick: (commonName: string) => void;
  /** Fired once when the fetch resolves so the parent can react to
   *  CATALOGUE microcopy / DEGENERATE fallback decisions. */
  onFallback?: (fallback: SelectionFallback) => void;
  /** Rendered when the fetch returns DEGENERATE. Typically the
   *  legacy free-text input retained until S2-T16's dead-code pass. */
  freeTextFallback: React.ReactNode;
}) {
  type Status = "idle" | "loading" | "ready" | "error" | "auth-required";
  const [status, setStatus] = useState<Status>("idle");
  const [candidates, setCandidates] = useState<QuizCandidate[]>([]);
  const [fallback, setFallback] = useState<SelectionFallback | null>(null);
  const onFallbackRef = useRef(onFallback);
  useEffect(() => {
    onFallbackRef.current = onFallback;
  }, [onFallback]);

  useEffect(() => {
    if (!isSignedIn) {
      // Anonymous: don't burn a 401 every mount. The parent's submit
      // path still redirects unauth users to signin on first click.
      setStatus("auth-required");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    fetch(`/api/snippets/${encodeURIComponent(snippetId)}/quiz`)
      .then(async (r) => {
        if (r.status === 401) {
          if (!cancelled) setStatus("auth-required");
          return null;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{
          candidates: QuizCandidate[];
          fallback: SelectionFallback;
        }>;
      })
      .then(async (data) => {
        if (cancelled || !data) return;

        // Preload all candidate thumbnails before flipping to "ready" so
        // users never see the picker render with half-loaded images
        // (or empty tiles that fill in moments later). We wait for every
        // image to either resolve or error, capped at 1500ms so a single
        // dead URL can't stall the picker forever.
        const urls = data.candidates
          .map((c) => c.thumbUrl)
          .filter((u): u is string => !!u);
        if (urls.length > 0) {
          await Promise.race([
            Promise.all(
              urls.map(
                (src) =>
                  new Promise<void>((resolve) => {
                    const img = new Image();
                    img.onload = () => resolve();
                    img.onerror = () => resolve();
                    img.src = src;
                  }),
              ),
            ),
            new Promise<void>((resolve) => setTimeout(resolve, 1500)),
          ]);
        }
        if (cancelled) return;

        setCandidates(data.candidates);
        setFallback(data.fallback);
        setStatus("ready");
        onFallbackRef.current?.(data.fallback);
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [snippetId, isSignedIn]);

  if (status === "auth-required") {
    // Show placeholder buttons + a sign-in nudge. Clicking still drives
    // the parent's submit path (which redirects unauth → /auth/signin).
    return (
      <div className="space-y-2 pb-2">
        <p className="text-[11px] text-white/55">
          Sign in to load the species options.
        </p>
        <button
          type="button"
          onClick={() => onPick("")}
          className="pebl-button-primary w-full px-4 py-2 text-sm"
        >
          Sign in to play
        </button>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="grid grid-cols-2 gap-2 pb-2 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square animate-pulse motion-reduce:animate-none rounded-modal bg-white/8"
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="space-y-2 pb-2">
        <p className="text-[11px] text-red-300">
          Couldn&apos;t load the species options. {freeTextFallback ? "Try the free-text fallback below." : "Try refreshing."}
        </p>
        {freeTextFallback}
      </div>
    );
  }

  if (status === "ready" && fallback === "DEGENERATE") {
    return (
      <div className="space-y-2 pb-2">
        <p className="text-[11px] text-white/55">
          Not enough comparable species in OBIS for this site. Type your guess below.
        </p>
        {freeTextFallback}
      </div>
    );
  }

  return (
    <div className="space-y-2 pb-2">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {candidates.map((candidate) => (
          <motion.button
            key={candidate.scientificName + candidate.commonName}
            type="button"
            disabled={submitting}
            whileTap={!submitting ? { scale: 0.96 } : undefined}
            onClick={() => onPick(candidate.commonName)}
            aria-label={`Pick ${candidate.commonName}`}
            className="group flex flex-col items-stretch overflow-hidden rounded-modal border border-white/12 bg-white/5 transition-colors hover:border-teal-500/70 hover:bg-white/10 disabled:opacity-60"
          >
            {candidate.thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- iNat hosts can change ID per refresh; <Image> would force us to allowlist every origin in next.config.
              <img
                src={candidate.thumbUrl}
                alt=""
                loading="eager"
                decoding="async"
                className="aspect-square w-full object-cover transition-opacity group-hover:opacity-90"
              />
            ) : (
              // No cached SpeciesImage row for this species (typically the
              // staff candidate — distractors are pre-filtered server-side).
              // Show a fish silhouette so the tile reads as intentional rather
              // than a broken-image void.
              <div
                className="flex aspect-square w-full items-center justify-center bg-white/10 text-white/35"
                aria-hidden="true"
              >
                <svg width="44" height="44" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2 8c2-3 5-4 8-4 1.6 0 2.8.4 3.8 1.1l1.7-1V11l-1.7-1c-1 .7-2.2 1.1-3.8 1.1-3 0-6-1-8-3z" />
                  <circle cx="10" cy="7" r="0.9" fill="#17252A" />
                </svg>
              </div>
            )}
            <span className="px-2 py-1.5 text-center text-[11px] font-semibold leading-tight text-white">
              {candidate.commonName}
            </span>
          </motion.button>
        ))}
      </div>
      {fallback === "CATALOGUE" && (
        <p className="text-[10px] text-white/40">
          Candidates drawn from catalogue (OBIS data unavailable here).
        </p>
      )}
    </div>
  );
}
