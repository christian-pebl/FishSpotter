"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useCreatureQuiz } from "@/lib/useCreatureQuiz";
import type { BBoxFrame, FeedSnippet } from "./FeedPlayer";
import { MapModal } from "./MapModal";
import { useVideoSettings, videoFilterFor } from "@/lib/videoSettings";

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
  const gradRef = useRef<SVGLinearGradientElement>(null);
  const glowGradRef = useRef<SVGLinearGradientElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const correctionAcceptRef = useRef<HTMLButtonElement>(null);
  const settings = useVideoSettings();
  const showTracking = settings.trace;
  const [mapOpen, setMapOpen] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [hasIdentifiedOnce, setHasIdentifiedOnce] = useState(true); // optimistic; corrected on mount
  const [showInputHint, setShowInputHint] = useState(false);
  const [submitPulse, setSubmitPulse] = useState<"none" | "correct">("none");
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasLocation =
    typeof snippet.lat === "number" &&
    typeof snippet.lon === "number" &&
    Number.isFinite(snippet.lat) &&
    Number.isFinite(snippet.lon);

  // Persist panel-collapsed state across cards in the same session.
  useEffect(() => {
    try {
      if (localStorage.getItem("fishspotter:panelCollapsed") === "1") {
        setPanelCollapsed(true);
      }
      setHasIdentifiedOnce(localStorage.getItem("fishspotter:hasIdentified") === "1");
    } catch {}
  }, []);
  const togglePanel = useCallback((next: boolean) => {
    setPanelCollapsed(next);
    try {
      localStorage.setItem("fishspotter:panelCollapsed", next ? "1" : "0");
    } catch {}
  }, []);

  // Apply playback speed when it changes.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = settings.speed;
  }, [settings.speed, isActive]);

  // Apply sound: muted by default; unmuted only when soundOn is true and the
  // browser allows it. If play() rejects with NotAllowedError, fall back to muted.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const targetMuted = !settings.soundOn;
    if (v.muted === targetMuted) return;
    v.muted = targetMuted;
    if (isActive && !v.paused) {
      v.play().catch(() => {
        v.muted = true;
      });
    }
  }, [settings.soundOn, isActive]);

  // Track mobile virtual keyboard so the panel rises above it.
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const onResize = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(offset);
    };
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, []);
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
        window.setTimeout(onAdvance, 450);
      }
    },
    [hasNext, onAdvance, submitting]
  );

  // Pulse the panel teal when the user submits a correct answer.
  useEffect(() => {
    if (myAnswer?.isCorrect) {
      setSubmitPulse("correct");
      const t = window.setTimeout(() => setSubmitPulse("none"), 600);
      return () => window.clearTimeout(t);
    }
  }, [myAnswer?.isCorrect]);

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
    <article className="relative h-full min-h-0 overflow-hidden bg-black text-white">
      <div className="absolute inset-0 overflow-hidden bg-black">
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
          style={{ filter: videoFilterFor(settings) }}
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
            </svg>

          </>
        )}
      </div>

      {/* Soft bottom gradient so the floating panel always reads over the video */}
      {!panelCollapsed && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-2/5 bg-gradient-to-t from-black/55 via-black/15 to-transparent"
        />
      )}

      {/* Collapsed pill — replaces the panel when minimized */}
      <AnimatePresence>
        {panelCollapsed && (
          <motion.button
            key="collapsed-pill"
            type="button"
            onClick={() => {
              togglePanel(false);
              try {
                localStorage.setItem("fishspotter:hasIdentified", "1");
              } catch {}
            }}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={
              reduceMotion
                ? { opacity: 1 }
                : hasIdentifiedOnce
                  ? { opacity: 1, y: 0 }
                  : { opacity: 1, y: 0, scale: [1, 1.04, 1] }
            }
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            transition={
              reduceMotion
                ? { duration: 0.18 }
                : hasIdentifiedOnce
                  ? { duration: 0.22, ease: "easeOut" }
                  : {
                      opacity: { duration: 0.22 },
                      y: { duration: 0.22 },
                      scale: { duration: 2.4, repeat: Infinity, ease: "easeInOut" },
                    }
            }
            aria-label="Name this species"
            className="absolute left-1/2 z-30 inline-flex min-h-[46px] -translate-x-1/2 items-center gap-2 rounded-full bg-[#3AAFA9] px-5 text-sm font-semibold text-[#17252A] shadow-[0_8px_22px_rgba(0,0,0,0.45),0_0_0_3px_rgba(58,175,169,0.18)] hover:bg-[#59c8c3]"
            style={{ bottom: `calc(0.5rem + env(safe-area-inset-bottom))` }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M2 8c2-3 5-4 8-4 1.6 0 2.8.4 3.8 1.1l1.7-1V11l-1.7-1c-1 .7-2.2 1.1-3.8 1.1-3 0-6-1-8-3z" />
              <circle cx="10" cy="7" r="0.9" fill="#17252A" />
            </svg>
            Name this species
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path
                d="M3 7.5L6 4.5L9 7.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Floating glass panel — Claude-style input or stats card */}
      <AnimatePresence>
        {!panelCollapsed && (
          <motion.aside
            key="panel"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{
              opacity: 1,
              y: 0,
              boxShadow:
                submitPulse === "correct"
                  ? "0 0 0 3px rgba(58,175,169,0.65), 0 8px 30px rgba(0,0,0,0.45)"
                  : "0 8px 30px rgba(0,0,0,0.45)",
            }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute inset-x-2 z-20 flex max-h-[calc(100%-3.5rem)] flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#17252A]/72 backdrop-blur-md backdrop-saturate-150 md:inset-x-auto md:left-1/2 md:w-[min(560px,calc(100%-2rem))] md:-translate-x-1/2"
            style={{
              bottom: `calc(${keyboardOffset}px + max(0.5rem, env(safe-area-inset-bottom)))`,
            }}
          >
            <div className="overflow-y-auto overscroll-contain px-3 pt-2 pb-2 md:px-4 md:pt-2.5 md:pb-3" style={{ paddingBottom: `max(0.5rem, env(safe-area-inset-bottom))` }}>
              {/* Eyebrow: site + pin (opens map) + collapse chevron */}
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => hasLocation && setMapOpen(true)}
                  disabled={!hasLocation}
                  aria-label={hasLocation ? "Show location on map" : undefined}
                  className="group inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55 transition-colors hover:text-white/85 disabled:cursor-default disabled:hover:text-white/55"
                >
                  {hasLocation && (
                    <svg width="11" height="11" viewBox="0 0 15 15" fill="none" aria-hidden="true" className="text-[#3AAFA9]/85 group-hover:text-[#3AAFA9]">
                      <path
                        d="M7.5 1.5C5 1.5 3 3.4 3 5.9c0 3.4 4.5 7.6 4.5 7.6s4.5-4.2 4.5-7.6c0-2.5-2-4.4-4.5-4.4z"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinejoin="round"
                        fill="none"
                      />
                      <circle cx="7.5" cy="5.9" r="1.5" fill="currentColor" />
                    </svg>
                  )}
                  <span>{snippet.site} · {snippet.deployment}</span>
                </button>
                <button
                  type="button"
                  onClick={() => togglePanel(true)}
                  aria-label="Hide identification panel"
                  className="-mr-1 flex h-6 w-6 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/10 hover:text-white/85"
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              {!showStats ? (
                <>
                  {/* Correction / error chips above the input */}
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
                        className="mb-2 rounded-xl border border-white/15 bg-white/8 px-2.5 py-2"
                      >
                        <p className="text-xs text-white/85">
                          Did you mean:{" "}
                          <span className="font-semibold text-[#DEF2F1]">{correction.suggestion}</span>?
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <motion.button
                            type="button"
                            ref={correctionAcceptRef}
                            onClick={() => submitAndAdvance(acceptCorrection)}
                            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                            className="rounded-full bg-[#DEF2F1] px-2.5 py-1 text-[11px] font-semibold text-[#17252A]"
                          >
                            Yes
                          </motion.button>
                          <motion.button
                            type="button"
                            onClick={() => submitAndAdvance(submitOriginal)}
                            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                            className="rounded-full border border-white/30 px-2.5 py-1 text-[11px] font-semibold text-white hover:border-[#3AAFA9]"
                          >
                            Use mine
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {submitError && (
                    <p
                      id={`species-error-${snippet.id}`}
                      role="alert"
                      className="mb-1.5 text-[11px] font-medium text-red-300"
                    >
                      {submitError}
                    </p>
                  )}

                  {/* Compact input row */}
                  <div className="flex items-center gap-2 pb-2">
                    <input
                      id={`species-answer-${snippet.id}`}
                      ref={inputRef}
                      type="text"
                      placeholder="What species is this?"
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      onFocus={() => {
                        try {
                          if (localStorage.getItem("fishspotter:inputHintSeen") !== "1") {
                            setShowInputHint(true);
                          }
                        } catch {}
                      }}
                      onBlur={() => setShowInputHint(false)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (showInputHint) {
                            setShowInputHint(false);
                            try { localStorage.setItem("fishspotter:inputHintSeen", "1"); } catch {}
                          }
                          void handleConfirmAndAdvance();
                        }
                      }}
                      autoComplete="off"
                      aria-describedby={submitError ? `species-error-${snippet.id}` : undefined}
                      aria-invalid={!!submitError}
                      className="min-h-[36px] min-w-0 flex-1 border-0 bg-transparent px-1 text-sm text-white outline-none placeholder:text-white/40"
                      style={{ caretColor: "#3AAFA9" }}
                    />
                    {hasNext && !answerText.trim() && (
                      <button
                        type="button"
                        onClick={onAdvance}
                        className="rounded-full px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-white/45 transition-colors hover:text-white/80"
                      >
                        Skip
                      </button>
                    )}
                    <motion.button
                      type="button"
                      onClick={handleConfirmAndAdvance}
                      disabled={!answerText.trim() || submitting}
                      aria-busy={submitting}
                      aria-label="Submit answer"
                      whileTap={!submitting && answerText.trim() && !reduceMotion ? { scale: 0.93 } : undefined}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3AAFA9] text-[#17252A] transition-colors hover:bg-[#59c8c3] disabled:cursor-not-allowed disabled:bg-[#3AAFA9]/30 disabled:text-[#17252A]/60"
                    >
                      {submitting ? (
                        <svg width="14" height="14" viewBox="0 0 14 14" className="animate-spin" aria-hidden="true">
                          <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="22" strokeDashoffset="16" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                          <path d="M7 11V3M7 3L3.5 6.5M7 3L10.5 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </motion.button>
                  </div>

                  <AnimatePresence>
                    {showInputHint && !answerText.trim() && (
                      <motion.p
                        key="hint"
                        initial={reduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="pb-1.5 text-[10px] text-white/40"
                      >
                        Press ↵ to submit · Skip to pass
                      </motion.p>
                    )}
                  </AnimatePresence>

                  {status !== "loading" && !session && !showInputHint && (
                    <p className="pb-1.5 text-[10px] text-white/45">
                      <Link
                        href={`/auth/signin?callbackUrl=${encodeURIComponent("/feed")}`}
                        className="text-[#DEF2F1] underline underline-offset-2"
                      >
                        Sign in
                      </Link>{" "}
                      to save your streak
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
                          ? { scale: 0.96, opacity: 0 }
                          : { x: 0 }
                    }
                    animate={
                      reduceMotion
                        ? { opacity: 1 }
                        : myAnswer!.isCorrect
                          ? { scale: 1, opacity: 1 }
                          : { x: [0, -8, 8, -6, 6, 0] }
                    }
                    transition={
                      myAnswer!.isCorrect
                        ? { type: "spring", stiffness: 320, damping: 22 }
                        : { duration: 0.36 }
                    }
                    className="pb-2"
                  >
                    <p className="text-sm">
                      You said{" "}
                      <span className="font-semibold text-white">{myAnswer!.chosenOption}</span>{" "}
                      {myAnswer!.isCorrect ? (
                        <span className="text-[#3AAFA9]">✓</span>
                      ) : (
                        <span className="text-red-300/85">· was {stats!.staffAnswer}</span>
                      )}
                    </p>
                    <div className="mt-1.5 space-y-0.5">
                      {stats!.stats.slice(0, 4).map((s) => (
                        <div key={s.option} className="flex items-center gap-1.5 text-[11px]">
                          <span className="w-16 truncate text-white/80">{s.option}</span>
                          <div className="h-1 flex-1 overflow-hidden rounded bg-white/10">
                            <div className="h-full rounded bg-[#3AAFA9]/70" style={{ width: `${s.percent}%` }} />
                          </div>
                          <span className="w-7 text-right tabular-nums text-white/55">{s.percent}%</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <Link href="/feed/browse" className="text-[10px] uppercase tracking-wider text-white/45 hover:text-white/80">
                        Archive
                      </Link>
                      {hasNext && (
                        <motion.button
                          type="button"
                          onClick={onAdvance}
                          whileTap={reduceMotion ? undefined : { scale: 0.95 }}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#3AAFA9] px-3 py-1.5 text-xs font-semibold text-[#17252A] hover:bg-[#59c8c3]"
                        >
                          Next
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                            <path d="M2 5h6M6 2.5L8.5 5L6 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
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
