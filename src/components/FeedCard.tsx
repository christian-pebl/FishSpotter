"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useCreatureQuiz } from "@/lib/useCreatureQuiz";
import type { BBoxFrame, FeedSnippet } from "./FeedPlayer";
import { MiniMapStatic } from "./MiniMapStatic";
import { MapModal } from "./MapModal";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const TRACE_POINT_LIMIT = 40;
// Bbox smoothing — lower = smoother trail, slightly more lag.
const BBOX_SMOOTH_ALPHA = 0.15;
// Camera follow — fish stays within deadzone, beyond which the view eases.
const CAM_DEADZONE_X = 0.18;
const CAM_DEADZONE_Y = 0.18;
const CAM_FOLLOW = 0.06;
// Min pixel delta before pushing a new point into the trail buffer.
const TRAIL_MIN_STEP_PX = 3;
// Edge cropping — keep the bbox at least this much (% of viewport) from any edge.
const SAFE_MARGIN = 0.06;
// Per-frame cap on edge-clamp camera push to avoid jolts (% of overflow).
const MAX_EDGE_PUSH = 0.04;
// Reset-fade duration when the video loops, in ms.
const LOOP_FADE_MS = 180;

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
  const progressRef = useRef<HTMLDivElement>(null);
  const correctionAcceptRef = useRef<HTMLButtonElement>(null);
  const [showTracking, setShowTracking] = useState(true);
  const [mapOpen, setMapOpen] = useState(false);
  const hasLocation =
    typeof snippet.lat === "number" &&
    typeof snippet.lon === "number" &&
    Number.isFinite(snippet.lat) &&
    Number.isFinite(snippet.lon);
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

  const [videoPaused, setVideoPaused] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (!isActive) {
      v.pause();
      setVideoPaused(false);
      return;
    }

    let cancelled = false;

    const tryPlay = () => {
      if (cancelled || !videoRef.current) return;
      videoRef.current.play().then(() => {
        if (!cancelled) { setVideoPaused(false); }
      }).catch((err: unknown) => {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : String(err);
        if (name === "NotAllowedError") {
          setVideoPaused(true);
        }
      });
    };

    if (v.readyState >= 3) {
      tryPlay();
    } else {
      const onCanPlay = () => {
        v.removeEventListener("canplay", onCanPlay);
        tryPlay();
      };
      v.addEventListener("canplay", onCanPlay);
      tryPlay();
      return () => {
        cancelled = true;
        v.removeEventListener("canplay", onCanPlay);
      };
    }

    return () => { cancelled = true; };
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
    const progress = progressRef.current;

    const hideAll = () => {
      video.style.objectPosition = "";
      if (overlay) overlay.style.opacity = "0";
      if (progress) progress.style.transform = "scaleX(0)";
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

    let cancelled = false;
    // Trail stored in WORLD (normalized) space — re-projected each frame so it
    // follows the camera correctly during pans.
    let worldPoints: Point[] = [];
    let smoothedNorm: Point | null = null;
    let camX = 0.5;
    let camY = 0.5;
    let lastCamXStr = "";
    let lastCamYStr = "";
    let prevTime = 0;
    let resetUntil = 0;
    let lastViewW = 0;
    let lastViewH = 0;

    const step = (mediaTime: number) => {
      const dur = video.duration;
      if (!Number.isFinite(dur) || dur <= 0) return;
      const t = Math.min(Math.max(mediaTime, 0), dur);

      // --- Loop reset detection ---
      const looped =
        (prevTime > dur - 0.15 && t < 0.15) || t < prevTime - 0.5;
      if (looped) {
        worldPoints = [];
        smoothedNorm = null;
        resetUntil = performance.now() + LOOP_FADE_MS;
        if (progress) {
          progress.classList.remove("fs-loop-pulse");
          // force reflow so the animation restarts
          void progress.offsetWidth;
          progress.classList.add("fs-loop-pulse");
        }
      }
      prevTime = t;

      if (progress) {
        progress.style.transform = `scaleX(${(t / dur).toFixed(4)})`;
      }

      const bbox = getBoxAtProgress(bboxes, t / dur);
      if (!bbox) return;

      const cw = video.clientWidth;
      const ch = video.clientHeight;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!cw || !ch || !vw || !vh) return;

      const scale = Math.max(cw / vw, ch / vh);
      const renderedWidth = vw * scale;
      const renderedHeight = vh * scale;
      const overflowX = Math.max(0, renderedWidth - cw);
      const overflowY = Math.max(0, renderedHeight - ch);

      const cxNorm = bbox.x_norm + bbox.w_norm / 2;
      const cyNorm = bbox.y_norm + bbox.h_norm / 2;

      // --- Deadzone follow (normalized) ---
      const dx = cxNorm - camX;
      const dy = cyNorm - camY;
      if (Math.abs(dx) > CAM_DEADZONE_X) {
        const want = cxNorm - Math.sign(dx) * CAM_DEADZONE_X;
        camX = clamp01(camX + (want - camX) * CAM_FOLLOW);
      }
      if (Math.abs(dy) > CAM_DEADZONE_Y) {
        const want = cyNorm - Math.sign(dy) * CAM_DEADZONE_Y;
        camY = clamp01(camY + (want - camY) * CAM_FOLLOW);
      }

      // --- Edge clamp (pixel-space) so the bbox never crosses the safe margin ---
      if (overflowX > 0) {
        const halfW = (bbox.w_norm * renderedWidth) / 2;
        const safeX = cw * SAFE_MARGIN;
        const camXMax = (cxNorm * renderedWidth - halfW - safeX) / overflowX;
        const camXMin = (cxNorm * renderedWidth + halfW - cw + safeX) / overflowX;
        if (camXMin <= camXMax) {
          const desired = Math.min(Math.max(camX, camXMin), camXMax);
          const delta = desired - camX;
          const limited = Math.sign(delta) * Math.min(Math.abs(delta), MAX_EDGE_PUSH);
          camX = clamp01(camX + limited);
        }
      }
      if (overflowY > 0) {
        const halfH = (bbox.h_norm * renderedHeight) / 2;
        const safeY = ch * SAFE_MARGIN;
        const camYMax = (cyNorm * renderedHeight - halfH - safeY) / overflowY;
        const camYMin = (cyNorm * renderedHeight + halfH - ch + safeY) / overflowY;
        if (camYMin <= camYMax) {
          const desired = Math.min(Math.max(camY, camYMin), camYMax);
          const delta = desired - camY;
          const limited = Math.sign(delta) * Math.min(Math.abs(delta), MAX_EDGE_PUSH);
          camY = clamp01(camY + limited);
        }
      }

      // --- Write objectPosition only on visible change ---
      const xStr = (camX * 100).toFixed(1);
      const yStr = (camY * 100).toFixed(1);
      if (xStr !== lastCamXStr || yStr !== lastCamYStr) {
        video.style.objectPosition = `${xStr}% ${yStr}%`;
        lastCamXStr = xStr;
        lastCamYStr = yStr;
      }

      // --- ViewBox only when size changes ---
      if (cw !== lastViewW || ch !== lastViewH) {
        overlay.setAttribute("viewBox", `0 0 ${cw} ${ch}`);
        lastViewW = cw;
        lastViewH = ch;
      }

      // --- EMA in normalized space so the trail follows correct world position ---
      smoothedNorm = smoothedNorm
        ? {
            x: mix(smoothedNorm.x, cxNorm, BBOX_SMOOTH_ALPHA),
            y: mix(smoothedNorm.y, cyNorm, BBOX_SMOOTH_ALPHA),
          }
        : { x: cxNorm, y: cyNorm };

      // --- Add new normalized trail point (dedup in normalized distance) ---
      const normStep = TRAIL_MIN_STEP_PX / Math.max(renderedWidth, renderedHeight);
      const lastWp = worldPoints[worldPoints.length - 1];
      if (
        !lastWp ||
        Math.hypot(lastWp.x - smoothedNorm.x, lastWp.y - smoothedNorm.y) > normStep
      ) {
        worldPoints = [
          ...worldPoints,
          { x: smoothedNorm.x, y: smoothedNorm.y },
        ].slice(-TRACE_POINT_LIMIT);
      }

      // --- Fade overlay during loop reset ---
      const inReset = performance.now() < resetUntil;
      overlay.style.opacity = inReset ? "0" : "1";
      if (inReset) return;

      // --- Project entire trail with CURRENT camera (fixes pan lag) ---
      const screenPoints: Point[] = worldPoints.map((p) => ({
        x: -overflowX * camX + p.x * renderedWidth,
        y: -overflowY * camY + p.y * renderedHeight,
      }));

      const pathD = buildSmoothPath(screenPoints);
      trailPath.setAttribute("d", pathD);
      trailGlowPath.setAttribute("d", pathD);

      if (screenPoints.length >= 2 && grad && glowGrad) {
        const tail = screenPoints[0];
        const head = screenPoints[screenPoints.length - 1];
        for (const g of [grad, glowGrad]) {
          g.setAttribute("x1", tail.x.toFixed(1));
          g.setAttribute("y1", tail.y.toFixed(1));
          g.setAttribute("x2", head.x.toFixed(1));
          g.setAttribute("y2", head.y.toFixed(1));
        }
      }

      const head = screenPoints[screenPoints.length - 1];
      if (head) {
        dot.setAttribute("cx", head.x.toFixed(1));
        dot.setAttribute("cy", head.y.toFixed(1));
        dot.setAttribute("opacity", "0.6");
        dotGlow.setAttribute("cx", head.x.toFixed(1));
        dotGlow.setAttribute("cy", head.y.toFixed(1));
        dotGlow.setAttribute("opacity", "0.18");
      }
    };

    // --- Frame-accurate scheduling: prefer requestVideoFrameCallback ---
    type RVFCMeta = { mediaTime: number };
    type RVFCCallback = (now: number, metadata: RVFCMeta) => void;
    type VideoWithRVFC = HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: RVFCCallback) => number;
      cancelVideoFrameCallback?: (id: number) => void;
    };
    const v = video as VideoWithRVFC;
    let rafId = 0;
    let rvfcId = 0;

    if (typeof v.requestVideoFrameCallback === "function") {
      const onFrame: RVFCCallback = (_now, metadata) => {
        if (cancelled) return;
        step(metadata.mediaTime);
        rvfcId = v.requestVideoFrameCallback!(onFrame);
      };
      rvfcId = v.requestVideoFrameCallback(onFrame);
    } else {
      const onRaf = () => {
        if (cancelled) return;
        step(video.currentTime);
        rafId = requestAnimationFrame(onRaf);
      };
      rafId = requestAnimationFrame(onRaf);
    }

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (rvfcId && typeof v.cancelVideoFrameCallback === "function") {
        v.cancelVideoFrameCallback(rvfcId);
      }
    };
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
          onCanPlay={() => {
            if (isActive) videoRef.current?.play().catch(() => {});
          }}
          onError={(e) => {
            const v = e.currentTarget;
            console.error("[FeedCard] video error", v.error?.code, v.error?.message, snippet.videoUrl.slice(-60));
          }}
          onKeyDown={(e) => {
            if (!isActive) return;
            if (e.key === " " || e.key === "k") {
              e.preventDefault();
              const v = videoRef.current;
              if (!v) return;
              if (v.paused) {
                v.play().then(() => setVideoPaused(false)).catch(() => {});
              } else {
                v.pause();
              }
            }
          }}
          className="absolute inset-0 w-full h-full object-cover focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#DEF2F1]"
        />
        {/* Playback progress bar — pulses on loop so the reset moment is visible */}
        {hasBboxes && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[3px] bg-white/10">
            <div
              ref={progressRef}
              className="h-full origin-left bg-[#3AAFA9]/85 shadow-[0_0_6px_rgba(58,175,169,0.6)]"
              style={{ transform: "scaleX(0)", willChange: "transform" }}
            />
          </div>
        )}
        {isActive && videoPaused && (
          <button
            type="button"
            aria-label="Tap to play"
            onClick={() => {
              videoRef.current?.play().then(() => setVideoPaused(false)).catch(() => {});
            }}
            className="absolute inset-0 flex items-center justify-center bg-black/30 z-10"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
          </button>
        )}

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
                  <stop offset="100%" stopColor="white" stopOpacity="0.45" />
                </linearGradient>
                <linearGradient id={glowGradId} ref={glowGradRef} gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="white" stopOpacity="0" />
                  <stop offset="100%" stopColor="white" stopOpacity="0.14" />
                </linearGradient>
                <filter id={filterId} x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="6" />
                </filter>
              </defs>

              {/* Soft glow behind the trace */}
              <path
                ref={trailGlowPathRef}
                fill="none"
                stroke={`url(#${glowGradId})`}
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={`url(#${filterId})`}
              />

              {/* Crisp main trace */}
              <path
                ref={trailPathRef}
                fill="none"
                stroke={`url(#${gradId})`}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Dot halo */}
              <circle ref={dotGlowRef} r="10" fill="white" opacity="0" filter={`url(#${filterId})`} />

              {/* Position dot */}
              <circle ref={dotRef} r="3.5" fill="white" opacity="0" />
            </svg>

            {/* Mobile-only map pin button — beside the tracking toggle */}
            {hasLocation && (
              <button
                type="button"
                onClick={() => setMapOpen(true)}
                aria-label="Show location on map"
                className="absolute bottom-3 right-[88px] z-10 flex min-h-[38px] min-w-[38px] items-center justify-center rounded-full bg-black/45 px-2.5 text-[rgba(222,242,241,0.9)] backdrop-blur-sm transition-colors hover:bg-black/65 md:hidden"
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                  <path
                    d="M7.5 1.5C5 1.5 3 3.4 3 5.9c0 3.4 4.5 7.6 4.5 7.6s4.5-4.2 4.5-7.6c0-2.5-2-4.4-4.5-4.4z"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  <circle cx="7.5" cy="5.9" r="1.5" fill="currentColor" />
                </svg>
              </button>
            )}

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
        {hasLocation && (
          <div className="mb-3 hidden md:block">
            <MiniMapStatic
              lat={snippet.lat as number}
              lon={snippet.lon as number}
              onClick={() => setMapOpen(true)}
              size={180}
            />
          </div>
        )}
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
      {hasLocation && (
        <MapModal
          open={mapOpen}
          onClose={() => setMapOpen(false)}
          lat={snippet.lat as number}
          lon={snippet.lon as number}
          site={`${snippet.site} · ${snippet.deployment}`}
        />
      )}
    </article>
  );
}
