"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useCreatureQuiz } from "@/lib/useCreatureQuiz";
import type { BBoxFrame, FeedSnippet } from "./FeedPlayer";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const TRACE_POINT_LIMIT = 40;

interface Point {
  x: number;
  y: number;
}

function hasUsableBox(box: BBoxFrame) {
  return [box.x_norm, box.y_norm, box.w_norm, box.h_norm].every(Number.isFinite);
}

function mix(a: number, b: number, amount: number) {
  return a + (b - a) * amount;
}

function interpolateBox(a: BBoxFrame, b: BBoxFrame, amount: number): BBoxFrame {
  return {
    frame_clip: mix(a.frame_clip, b.frame_clip, amount),
    x_norm: mix(a.x_norm, b.x_norm, amount),
    y_norm: mix(a.y_norm, b.y_norm, amount),
    w_norm: mix(a.w_norm, b.w_norm, amount),
    h_norm: mix(a.h_norm, b.h_norm, amount),
  };
}

function getBoxAtProgress(bboxes: BBoxFrame[], progress: number) {
  if (bboxes.length === 0) return null;
  if (bboxes.length === 1) return bboxes[0];

  const firstFrame = bboxes[0].frame_clip;
  const lastFrame = bboxes[bboxes.length - 1].frame_clip;

  if (lastFrame <= firstFrame) {
    const scaledIndex = clamp01(progress) * (bboxes.length - 1);
    const lowerIndex = Math.floor(scaledIndex);
    const upperIndex = Math.min(bboxes.length - 1, lowerIndex + 1);
    return interpolateBox(bboxes[lowerIndex], bboxes[upperIndex], scaledIndex - lowerIndex);
  }

  const targetFrame = firstFrame + clamp01(progress) * (lastFrame - firstFrame);
  const upperIndex = bboxes.findIndex((box) => box.frame_clip >= targetFrame);
  if (upperIndex === -1) return bboxes[bboxes.length - 1];
  if (upperIndex === 0) return bboxes[0];

  const lower = bboxes[upperIndex - 1];
  const upper = bboxes[upperIndex];
  const span = upper.frame_clip - lower.frame_clip;
  const amount = span > 0 ? (targetFrame - lower.frame_clip) / span : 0;
  return interpolateBox(lower, upper, amount);
}

function getRenderedCenter(video: HTMLVideoElement, bbox: BBoxFrame) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const cw = video.clientWidth;
  const ch = video.clientHeight;
  if (!vw || !vh || !cw || !ch) return null;

  const scale = Math.max(cw / vw, ch / vh);
  const renderedWidth = vw * scale;
  const renderedHeight = vh * scale;
  const overflowX = Math.max(0, renderedWidth - cw);
  const overflowY = Math.max(0, renderedHeight - ch);
  const centerXNorm = bbox.x_norm + bbox.w_norm / 2;
  const centerYNorm = bbox.y_norm + bbox.h_norm / 2;
  const objectX = overflowX > 0 ? clamp01((centerXNorm * renderedWidth - cw / 2) / overflowX) : 0.5;
  const objectY = overflowY > 0 ? clamp01((centerYNorm * renderedHeight - ch / 2) / overflowY) : 0.5;
  const left = -overflowX * objectX;
  const top = -overflowY * objectY;
  const cx = left + centerXNorm * renderedWidth;
  const cy = top + centerYNorm * renderedHeight;

  video.style.objectPosition = `${(objectX * 100).toFixed(2)}% ${(objectY * 100).toFixed(2)}%`;

  return { cx, cy, viewWidth: cw, viewHeight: ch };
}

// Catmull-Rom spline → cubic bezier SVG path for smooth curves through all stored points.
function buildSmoothPath(pts: Point[]): string {
  if (pts.length < 2) return "";
  if (pts.length === 2) {
    return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}L${pts[1].x.toFixed(1)},${pts[1].y.toFixed(1)}`;
  }
  const parts: string[] = [`M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    parts.push(
      `C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
    );
  }
  return parts.join("");
}

interface FeedCardProps {
  snippet: FeedSnippet;
  isActive: boolean;
  preload: boolean;
  hasNext: boolean;
  onAdvance: () => void;
}

export function FeedCard({ snippet, isActive, preload, hasNext, onAdvance }: FeedCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const trailPathRef = useRef<SVGPathElement>(null);
  const trailGlowPathRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const dotGlowRef = useRef<SVGCircleElement>(null);
  const gradRef = useRef<SVGLinearGradientElement>(null);
  const glowGradRef = useRef<SVGLinearGradientElement>(null);
  const correctionAcceptRef = useRef<HTMLButtonElement>(null);
  const [showTracking, setShowTracking] = useState(true);
  const reduceMotion = useReducedMotion();
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
  } = useCreatureQuiz(snippet, "/feed");

  const bboxes = useMemo(
    () =>
      (snippet.bboxes ?? [])
        .filter(hasUsableBox)
        .map((box, index) => ({
          ...box,
          frame_clip: Number.isFinite(box.frame_clip) ? box.frame_clip : index,
        }))
        .sort((a, b) => a.frame_clip - b.frame_clip),
    [snippet.bboxes]
  );

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      // play() may race with src load — retry on canplay if it rejects
      const attempt = v.play();
      if (attempt !== undefined) {
        attempt.catch(() => {
          const onCanPlay = () => {
            v.play().catch(() => {});
            v.removeEventListener("canplay", onCanPlay);
          };
          v.addEventListener("canplay", onCanPlay);
        });
      }
    } else {
      v.pause();
    }
  }, [isActive]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const overlay = overlayRef.current;
    const trailPath = trailPathRef.current;
    const trailGlowPath = trailGlowPathRef.current;
    const dot = dotRef.current;
    const dotGlow = dotGlowRef.current;
    const grad = gradRef.current;
    const glowGrad = glowGradRef.current;

    const hideAll = () => {
      video.style.objectPosition = "";
      if (overlay) overlay.style.opacity = "0";
    };

    if (
      !isActive ||
      bboxes.length === 0 ||
      !overlay ||
      !trailPath ||
      !trailGlowPath ||
      !dot ||
      !dotGlow ||
      !showTracking
    ) {
      hideAll();
      return;
    }

    let raf = 0;
    let points: Point[] = [];

    const tick = () => {
      const dur = video.duration;
      if (Number.isFinite(dur) && dur > 0) {
        const t = Math.min(Math.max(video.currentTime, 0), dur);
        const bbox = getBoxAtProgress(bboxes, t / dur);
        const rendered = bbox ? getRenderedCenter(video, bbox) : null;

        if (rendered) {
          overlay.setAttribute("viewBox", `0 0 ${rendered.viewWidth} ${rendered.viewHeight}`);
          overlay.style.opacity = "1";

          const lastPoint = points[points.length - 1];
          if (!lastPoint || Math.hypot(lastPoint.x - rendered.cx, lastPoint.y - rendered.cy) > 1) {
            points = [...points, { x: rendered.cx, y: rendered.cy }].slice(-TRACE_POINT_LIMIT);
          }

          const pathD = buildSmoothPath(points);
          trailPath.setAttribute("d", pathD);
          trailGlowPath.setAttribute("d", pathD);

          // Orient gradient tail→head so the trail fades in toward the fish.
          if (points.length >= 2 && grad && glowGrad) {
            const tail = points[0];
            const head = points[points.length - 1];
            for (const g of [grad, glowGrad]) {
              g.setAttribute("x1", tail.x.toFixed(1));
              g.setAttribute("y1", tail.y.toFixed(1));
              g.setAttribute("x2", head.x.toFixed(1));
              g.setAttribute("y2", head.y.toFixed(1));
            }
          }

          dot.setAttribute("cx", rendered.cx.toFixed(1));
          dot.setAttribute("cy", rendered.cy.toFixed(1));
          dot.setAttribute("opacity", "0.9");
          dotGlow.setAttribute("cx", rendered.cx.toFixed(1));
          dotGlow.setAttribute("cy", rendered.cy.toFixed(1));
          dotGlow.setAttribute("opacity", "0.35");
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bboxes, isActive, showTracking]);

  const submitAndAdvance = useCallback(
    async (submit: () => Promise<boolean>) => {
      if (submitting) return;
      const didSubmit = await submit();
      if (didSubmit && hasNext) {
        window.setTimeout(onAdvance, 250);
      }
    },
    [hasNext, onAdvance, submitting]
  );

  const handleConfirmAndAdvance = useCallback(async () => {
    if (!answerText.trim()) return;
    await submitAndAdvance(() => handleSubmit());
  }, [answerText, handleSubmit, submitAndAdvance]);

  const showStats = myAnswer && stats;
  const hasBboxes = bboxes.length > 0;

  // Stable per-snippet IDs for SVG defs (multiple FeedCards live in the DOM simultaneously).
  const gradId = `trail-grad-${snippet.id}`;
  const glowGradId = `trail-glow-grad-${snippet.id}`;
  const filterId = `dot-glow-${snippet.id}`;

  return (
    <article className="flex h-full min-h-0 flex-col bg-[#17252A] text-white md:flex-row">
      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          {...(preload ? { src: snippet.videoUrl } : {})}
          poster={snippet.thumbnailUrl}
          muted
          playsInline
          loop
          preload={isActive ? "auto" : preload ? "metadata" : "none"}
          tabIndex={isActive ? 0 : -1}
          aria-label={`Underwater clip from ${snippet.site} ${snippet.deployment}. Press space to play or pause.`}
          onKeyDown={(e) => {
            if (!isActive) return;
            if (e.key === " " || e.key === "k") {
              e.preventDefault();
              const v = videoRef.current;
              if (!v) return;
              if (v.paused) v.play().catch(() => {});
              else v.pause();
            }
          }}
          className="absolute inset-0 w-full h-full object-cover focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#DEF2F1]"
          style={{ transition: "object-position 80ms linear" }}
        />

        {hasBboxes && (
          <>
            <svg
              ref={overlayRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full opacity-0 transition-opacity duration-200"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id={gradId} ref={gradRef} gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="white" stopOpacity="0" />
                  <stop offset="100%" stopColor="white" stopOpacity="0.82" />
                </linearGradient>
                <linearGradient id={glowGradId} ref={glowGradRef} gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="white" stopOpacity="0" />
                  <stop offset="100%" stopColor="white" stopOpacity="0.28" />
                </linearGradient>
                <filter id={filterId} x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="5" />
                </filter>
              </defs>

              {/* Soft glow behind the trace */}
              <path
                ref={trailGlowPathRef}
                fill="none"
                stroke={`url(#${glowGradId})`}
                strokeWidth="14"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={`url(#${filterId})`}
              />

              {/* Crisp main trace */}
              <path
                ref={trailPathRef}
                fill="none"
                stroke={`url(#${gradId})`}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Dot halo */}
              <circle ref={dotGlowRef} r="11" fill="white" opacity="0" filter={`url(#${filterId})`} />

              {/* Position dot */}
              <circle ref={dotRef} r="4.5" fill="white" opacity="0" />
            </svg>

            {/* Tracking toggle button — bottom-right of video panel */}
            <button
              type="button"
              onClick={() => setShowTracking((v) => !v)}
              aria-label={showTracking ? "Hide fish tracking" : "Show fish tracking"}
              aria-pressed={showTracking}
              className="absolute bottom-3 right-3 z-10 flex min-h-[38px] min-w-[38px] items-center justify-center gap-1.5 rounded-full bg-black/45 px-2.5 backdrop-blur-sm transition-colors hover:bg-black/65"
              style={{ color: showTracking ? "rgba(222,242,241,0.9)" : "rgba(255,255,255,0.4)" }}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                <circle cx="12" cy="7.5" r="2.5" fill="currentColor" />
                <path
                  d="M1.5 11 Q4 3.5 8.5 6.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.65"
                />
              </svg>
              <span className="hidden pr-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] sm:inline">
                {showTracking ? "On" : "Off"}
              </span>
            </button>
          </>
        )}
      </div>

      <aside className="max-h-[46vh] shrink-0 overflow-y-auto border-t border-white/10 bg-[#17252A] px-4 py-4 text-white md:max-h-none md:w-[360px] md:border-l md:border-t-0 md:px-5 md:py-5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#DEF2F1]">
          {snippet.site} · {snippet.deployment}
        </p>
        <h2 className="font-brand-heading mb-3 text-2xl">What species is this?</h2>

        {!showStats ? (
          <>
            <label
              htmlFor={`species-answer-${snippet.id}`}
              className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-white/75"
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
                  void handleConfirmAndAdvance();
                }
              }}
              autoComplete="off"
              aria-describedby={submitError ? `species-error-${snippet.id}` : undefined}
              aria-invalid={!!submitError}
              className="mb-3 w-full rounded-2xl border border-white/30 bg-white px-3 py-2.5 text-sm text-[#17252A] outline-none placeholder:text-[#17252A]/55 focus:border-[#DEF2F1]"
              style={{ color: "#17252A", WebkitTextFillColor: "#17252A", caretColor: "#2B7A78" }}
            />
            <AnimatePresence>
              {correction && (
                <motion.div
                  key="correction"
                  initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  role="dialog"
                  aria-label="Spelling suggestion"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      void submitAndAdvance(submitOriginal);
                    }
                  }}
                  ref={(el) => {
                    if (el) {
                      const t = window.setTimeout(() => correctionAcceptRef.current?.focus(), 0);
                      return () => window.clearTimeout(t);
                    }
                  }}
                  className="mb-3 rounded-2xl border border-white/18 bg-white/10 p-3"
                >
                  <p className="text-sm text-white/86">
                    Did you mean:{" "}
                    <span className="font-semibold text-[#DEF2F1]">{correction.suggestion}</span>?
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <motion.button
                      type="button"
                      ref={correctionAcceptRef}
                      onClick={() => submitAndAdvance(acceptCorrection)}
                      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                      className="rounded-full bg-[#DEF2F1] min-h-[40px] px-3 py-1.5 text-xs font-semibold text-[#17252A]"
                    >
                      Yes, use that
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={() => submitAndAdvance(submitOriginal)}
                      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                      className="rounded-full border border-white/30 min-h-[40px] px-3 py-1.5 text-xs font-semibold text-white hover:border-[#3AAFA9]"
                    >
                      Use my answer
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {submitError && (
              <p
                id={`species-error-${snippet.id}`}
                role="alert"
                className="mb-3 text-xs font-medium text-red-200"
              >
                {submitError}
              </p>
            )}
            <motion.button
              type="button"
              onClick={handleConfirmAndAdvance}
              disabled={!answerText.trim() || submitting}
              aria-busy={submitting}
              whileTap={!submitting && answerText.trim() && !reduceMotion ? { scale: 0.97 } : undefined}
              className="w-full inline-flex items-center justify-center min-h-[44px] rounded-full bg-[#3AAFA9] px-4 py-2.5 text-sm font-semibold text-[#17252A] hover:bg-[#59c8c3] disabled:cursor-not-allowed disabled:bg-[#3AAFA9]/70 disabled:text-[#17252A]/70 sm:w-auto"
            >
              {submitting ? "Submitting…" : hasNext ? "Confirm and load next video" : "Confirm selection"}
            </motion.button>
            {status !== "loading" && !session && (
              <p className="mt-2 text-xs text-white/75">
                <Link
                  href={`/auth/signin?callbackUrl=${encodeURIComponent("/feed")}`}
                  className="text-[#DEF2F1] underline underline-offset-4"
                >
                  Sign in
                </Link>{" "}
                to record your answer and keep your PEBL streak alive.
              </p>
            )}
          </>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={myAnswer!.isCorrect ? "correct" : "wrong"}
              initial={
                reduceMotion
                  ? false
                  : myAnswer!.isCorrect
                    ? { scale: 0.9, opacity: 0 }
                    : { x: 0 }
              }
              animate={
                reduceMotion
                  ? { opacity: 1 }
                  : myAnswer!.isCorrect
                    ? { scale: 1, opacity: 1 }
                    : { x: [0, -10, 10, -8, 8, 0] }
              }
              transition={
                myAnswer!.isCorrect
                  ? { type: "spring", stiffness: 300, damping: 20 }
                  : { duration: 0.4 }
              }
              className="space-y-3"
            >
              <p className="text-sm font-medium text-[#DEF2F1]">
                You said: {myAnswer!.chosenOption}{" "}
                {myAnswer!.isCorrect && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, delay: 0.1 }}
                  >
                    ✓ Correct!
                  </motion.span>
                )}
              </p>
              <div className="text-xs">
                <h3 className="mb-1 font-medium uppercase tracking-[0.14em] text-white/80">
                  Community response
                </h3>
                <ul className="space-y-0.5">
                  {stats!.stats.slice(0, 4).map((s) => (
                    <li key={s.option} className="flex items-center gap-2">
                      <span className="w-20">{s.option}</span>
                      <span className="text-white/65">{s.percent}%</span>
                      <div className="max-w-[120px] flex-1 overflow-hidden rounded bg-white/12 h-1.5">
                        <div className="h-full rounded bg-[#3AAFA9]" style={{ width: `${s.percent}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-white/65">PEBL reference: {stats!.staffAnswer}</p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-white/75">
                {hasNext && (
                  <motion.button
                    type="button"
                    onClick={onAdvance}
                    whileTap={{ scale: 0.97 }}
                    className="rounded-full bg-[#3AAFA9] px-4 py-2 text-sm font-semibold text-[#17252A] hover:bg-[#59c8c3]"
                  >
                    Load next video
                  </motion.button>
                )}
                <Link href="/feed/browse" className="text-[#DEF2F1] underline underline-offset-4">
                  Open archive
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </aside>
    </article>
  );
}
