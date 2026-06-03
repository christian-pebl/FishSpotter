"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useDragControls, useReducedMotion } from "framer-motion";
import { useCreatureQuiz } from "@/lib/useCreatureQuiz";
import type { BBoxFrame, FeedSnippet } from "./FeedPlayer";
import { MapModal } from "./MapModal";
import { useVideoSettings, videoFilterFor } from "@/lib/videoSettings";
import { RarityPanel } from "./RarityPanel";
import { IdGuideTrigger } from "./IdGuideTrigger";
import { MCQCandidatePicker } from "./MCQCandidatePicker";
import { SpeciesGallery } from "./SpeciesGallery";
import { AnnotatedSpeciesPhoto } from "./AnnotatedSpeciesPhoto";
import { ShapeGate } from "./ShapeGate";
import { BodyShapeGate } from "./idflow/BodyShapeGate";
import { CandidateStrip } from "./idflow/CandidateStrip";
import { bodyFormConfigFor } from "@/lib/idflow/body-forms";
import type { TraitKey } from "@/lib/idguide/narrow";
import type { ShapeClass } from "@/lib/idguide/traits";
import { DURATION, EASE, TRANSITION, spring } from "@/lib/motion";

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
  /** Q3A-T7: fired after a successful submit so the parent feed can
   *  optimistically move this card to the back of the queue. */
  onAnswered?: () => void;
}

export function FeedCard({ snippet, isActive, preload, hasNext, onAdvance, onAnswered }: FeedCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const trailPathRef = useRef<SVGPathElement>(null);
  const trailGlowPathRef = useRef<SVGPathElement>(null);
  const gradRef = useRef<SVGLinearGradientElement>(null);
  const glowGradRef = useRef<SVGLinearGradientElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const settings = useVideoSettings();
  const showTracking = settings.trace;
  const [mapOpen, setMapOpen] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  // UX-0: "Spot It" shape-class gate.
  const [shapeGateOpen, setShapeGateOpen] = useState(false);
  const [selectedShape, setSelectedShape] = useState<ShapeClass | null>(null);
  // (3 Jun) Rung 2: the body-shape gate, shown between the shape gate and the
  // strip for classes that have a discriminating sub-split. formSeed carries the
  // chosen form down into the strip's narrowing.
  const [bodyGateOpen, setBodyGateOpen] = useState(false);
  const [formSeed, setFormSeed] = useState<{ key: TraitKey; value: string | null } | null>(null);
  // The Spot It strip shows once the user engages the gate, including via
  // "Not sure" (selectedShape stays null -> the strip narrows the whole
  // catalogue). Distinct from selectedShape so "Not sure" never dead-ends.
  const [spotItActive, setSpotItActive] = useState(false);
  // (3 Jun) Guided-first identify flow. The default path is the step-by-step
  // "Spot It" shape gate; the MCQ tile grid is no longer shown first — it only
  // renders as a "skip to guess" fallback once the user opts into it.
  const [guessMode, setGuessMode] = useState(false);
  // (3 Jun) "Show where on screen" radar ping — concentric rings that track the
  // bbox trail head so the user can find the creature in the clip. tracePosRef
  // is updated each frame by the trail render loop; the ping element follows it.
  const [showPing, setShowPing] = useState(false);
  const [pingKey, setPingKey] = useState(0);
  const tracePosRef = useRef<{ x: number; y: number } | null>(null);
  const pingElRef = useRef<HTMLDivElement>(null);
  const pingActiveRef = useRef(false);
  const pingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirror showPing into a ref so the rAF trail loop can move the ping element
  // without being re-subscribed on every toggle.
  useEffect(() => {
    pingActiveRef.current = showPing;
  }, [showPing]);
  const triggerPing = useCallback(() => {
    if (pingTimerRef.current) clearTimeout(pingTimerRef.current);
    setPingKey((k) => k + 1);
    setShowPing(true);
    pingTimerRef.current = setTimeout(() => setShowPing(false), 3500);
  }, []);
  // S2-T11: watch-first gate. The expanded quiz panel only mounts once
  // the user has either watched the clip through one loop OR manually
  // tapped the collapsed pill to expand. Encourages observation before
  // commitment without blocking impatient users.
  const [hasCompletedFirstLoop, setHasCompletedFirstLoop] = useState(false);
  const [userHasExpandedManually, setUserHasExpandedManually] = useState(false);
  const [hasIdentifiedOnce, setHasIdentifiedOnce] = useState(true); // optimistic; corrected on mount
  const [showInputHint, setShowInputHint] = useState(false);
  const [submitPulse, setSubmitPulse] = useState<"none" | "correct">("none");
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  // Surfaced by RarityPanel once /api/snippets/[id]/probability resolves.
  // Used by the inline SpeciesGallery in the reveal card (S2-T08) so we
  // don't fire a second /probability fetch.
  const [staffScientific, setStaffScientific] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // framer-motion drag, gated on the visible handle so taps on form
  // controls don't accidentally initiate a drag.
  const dragControls = useDragControls();
  const articleRef = useRef<HTMLElement>(null);
  // Default panel position: vertically centered on desktop, bottom-snapped on
  // mobile. Use a lazy initialiser so the first client paint already knows the
  // right breakpoint — avoids the mobile→desktop flicker on hydration.
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(min-width: 768px)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // P-2: at lg (1024px) the panel shifts to the right side of the video,
  // giving the left ~65% of the viewport for unobstructed viewing. Below lg
  // it stays centred (isDesktop path) or bottom-anchored (mobile path).
  const [isLg, setIsLg] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(min-width: 1024px)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setIsLg(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

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
    if (!next) {
      // Manually expanding the pill counts as an explicit
      // "I'm ready to identify" signal for the watch-first gate
      // (S2-T11), so we satisfy the gate without waiting for the
      // first video loop to finish.
      setUserHasExpandedManually(true);
    }
    try {
      localStorage.setItem("fishspotter:panelCollapsed", next ? "1" : "0");
    } catch {}
  }, []);

  // Keyboard shortcut: press H while the active card is in view to
  // toggle the identification panel — gives users a fast way to flip
  // between looking at the video (for shape, markings, behaviour) and
  // the candidate picker without hunting for the minimize button.
  // Skip when focus is in a text input so typing "h" still works.
  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "h" && e.key !== "H") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        return;
      }
      // Q3A-T2: if the IdGuide sheet is open, H means "close the sheet"
      // (handled by IdGuideSheet's own keydown). Don't ALSO toggle the
      // candidate panel underneath, or the user gets two changes per
      // keystroke.
      if (document.body.dataset.idGuideOpen === "1") return;
      e.preventDefault();
      setPanelCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem("fishspotter:panelCollapsed", next ? "1" : "0");
        } catch {}
        return next;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isActive]);

  // S2-T11: watch the video for a single full loop and flip the gate.
  // Detect a loop by listening for `ended` (browser auto-loops with the
  // <video loop> attribute, but ended still fires on each cycle on
  // some browsers; we additionally watch for currentTime jumping
  // backwards as a fallback). Once true, the gate stays true for
  // the lifetime of the card.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (hasCompletedFirstLoop) return;
    let lastTime = 0;
    const onLoopMaybe = () => {
      setHasCompletedFirstLoop(true);
      v.removeEventListener("ended", onLoopMaybe);
      v.removeEventListener("timeupdate", onTime);
    };
    const onTime = () => {
      // Time jumping backwards by >0.3s is a loop wrap.
      if (lastTime - v.currentTime > 0.3) {
        onLoopMaybe();
        return;
      }
      lastTime = v.currentTime;
    };
    v.addEventListener("ended", onLoopMaybe);
    v.addEventListener("timeupdate", onTime);
    return () => {
      v.removeEventListener("ended", onLoopMaybe);
      v.removeEventListener("timeupdate", onTime);
    };
  }, [hasCompletedFirstLoop]);

  // The expanded quiz panel renders only when the gate is satisfied
  // OR the user has manually expanded the pill. We collapse-by-default
  // at mount if the gate isn't yet satisfied (and we don't already
  // have a saved-collapsed preference from a previous card).
  useEffect(() => {
    if (panelCollapsed) return;
    if (hasCompletedFirstLoop || userHasExpandedManually) return;
    // Defer to the localStorage preference once it's loaded.
    setPanelCollapsed(true);
    // We deliberately don't persist this transient collapse to
    // localStorage — it's the watch-first gate, not a user preference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (3 Jun fix) The identify panel no longer auto-expands after the first
  // video loop. The clip loops indefinitely and the panel opens ONLY on an
  // explicit user action — tapping the collapsed "tap to identify" pill or
  // the H shortcut — so watching is never interrupted by a popup. The
  // first-loop signal is still tracked (it softens the pill hint text), it
  // just no longer forces the panel open.

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
    submitError,
    handleSubmit,
    editAnswer,
    setEditFocusCallback,
  } = useCreatureQuiz(snippet, "/feed");

  // S2-T09: tell the hook how to refocus the input on edit. Only used
  // when the DEGENERATE fallback renders the legacy input — otherwise
  // the inputRef is null and the callback is a harmless no-op.
  useEffect(() => {
    setEditFocusCallback(() => {
      inputRef.current?.focus();
    });
    return () => setEditFocusCallback(null);
  }, [setEditFocusCallback]);

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

      // (3 Jun) Track the trail head so the "Show where on screen" ping can
      // follow the creature; move the ping element when it's active.
      const traceHead = screenPoints[screenPoints.length - 1];
      if (traceHead) {
        tracePosRef.current = traceHead;
        if (pingActiveRef.current && pingElRef.current) {
          pingElRef.current.style.left = `${traceHead.x}px`;
          pingElRef.current.style.top = `${traceHead.y}px`;
        }
      }

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

  // Q4-A-10: the design review's #1 finding (signup + daily-driver
  // journeys, +AI-smell auditor) was that the reveal panel — the best
  // teaching moment in the app — is invisible because we auto-advance
  // 450ms after submit. First-time users submit and never find their
  // result. Fix: do nothing on submit beyond rendering the reveal.
  // The user reads the reveal in-place, then explicitly taps Next
  // (which also moves the card to the back via onAnswered). This also
  // means a walking mobile user can't have the reveal yanked away
  // before they finish reading it.
  const submitAndAdvance = useCallback(
    async (submit: () => Promise<boolean>) => {
      if (submitting) return;
      await submit();
      // No setTimeout. No onAdvance. No onAnswered. The reveal panel
      // is the destination — not a step. handleAdvanceFromReveal below
      // owns the transition out.
    },
    [submitting]
  );

  // Wrap onAdvance so the explicit Next/Skip tap also notifies the
  // parent to move-to-back. Stable identity for inline onClick.
  const handleAdvanceFromReveal = useCallback(() => {
    onAnswered?.();
    onAdvance();
  }, [onAdvance, onAnswered]);

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
  // UX-4 reveal verdict tiers (Workstream E scored-by-rung). A "partial" is the
  // right shape class but wrong species (points > 0, isCorrect false). Only a
  // true miss (0 points) gets the error shake; partial reads as encouraging.
  const revealPartial =
    !!myAnswer && myAnswer.isCorrect === false && myAnswer.points > 0;
  const revealWrong =
    !!myAnswer && myAnswer.isCorrect === false && myAnswer.points === 0;
  const hasBboxes = bboxes.length > 0;

  // Stable per-snippet IDs for SVG defs (multiple FeedCards live in the DOM simultaneously).
  const gradId = `trail-grad-${snippet.id}`;
  const glowGradId = `trail-glow-grad-${snippet.id}`;
  const filterId = `dot-glow-${snippet.id}`;

  return (
    <article ref={articleRef} className="relative h-full min-h-0 overflow-hidden bg-black text-white">
      {/* (3 Jun) Video sits ABOVE a thin 56px docked bar so the clip is never
          overlapped by the identify entry while watching. All video overlays
          (bbox trail, progress, paused, fade) live in this container, so they
          inset together and stay aligned. */}
      <div className="absolute inset-x-0 top-0 bottom-14 overflow-hidden bg-black">
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
              className="h-full origin-left bg-teal-500/85 shadow-glow"
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

        {/* (3 Jun) "Show where on screen" radar ping — concentric rings that
            follow the tracking-trace head (updated each frame by the trail loop). */}
        {showPing && hasBboxes && (
          <div
            key={pingKey}
            ref={pingElRef}
            aria-hidden="true"
            className="pointer-events-none absolute z-20"
            style={{
              left: tracePosRef.current ? `${tracePosRef.current.x}px` : "50%",
              top: tracePosRef.current ? `${tracePosRef.current.y}px` : "50%",
            }}
          >
            <span className="fs-radar-ring" />
            <span className="fs-radar-ring" style={{ animationDelay: "0.5s" }} />
            <span className="fs-radar-ring" style={{ animationDelay: "1s" }} />
            <span className="fs-radar-dot" />
          </div>
        )}
      </div>

      {/* Soft bottom gradient so the floating panel always reads over the video.
          Desktop centres the panel mid-screen so the bottom gradient just
          obscures the seabed — only render it on mobile, and keep it
          subtler so species near the lower edge stay visible. */}
      {!panelCollapsed && !isDesktop && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1/4 bg-gradient-to-t from-black/40 via-black/10 to-transparent"
        />
      )}

      {/* Collapsed pill — replaces the panel when minimized. Also hidden while a
          gate is open so the gate is the only box on screen. */}
      <AnimatePresence>
        {panelCollapsed && !shapeGateOpen && !bodyGateOpen && (
          <motion.div
            key="identify-bar"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            transition={TRANSITION.standard}
            // (3 Jun) Dark-themed docked bar matching the shape gate. Two
            // actions: open the step-by-step flow, and radar-ping the creature.
            className="absolute inset-x-0 bottom-0 z-30 flex h-14 items-stretch border-t border-white/10 bg-navy-900/95 backdrop-blur"
          >
            <button
              type="button"
              onClick={() => {
                togglePanel(false);
                // Lead with the step-by-step shape flow, not the MCQ tiles.
                if (!myAnswer && !guessMode && !spotItActive && !bodyGateOpen) setShapeGateOpen(true);
                try {
                  localStorage.setItem("fishspotter:hasIdentified", "1");
                } catch {}
              }}
              aria-label="Name this species (press H)"
              title="Press H to toggle"
              className="flex flex-1 items-center justify-center gap-2 px-5 text-sm font-semibold text-teal-50 transition-colors hover:bg-white/5"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="text-teal-300">
                <path d="M2 8c2-3 5-4 8-4 1.6 0 2.8.4 3.8 1.1l1.7-1V11l-1.7-1c-1 .7-2.2 1.1-3.8 1.1-3 0-6-1-8-3z" />
                <circle cx="10" cy="7" r="0.9" fill="#17252A" />
              </svg>
              {hasCompletedFirstLoop || userHasExpandedManually
                ? "Name this species"
                : "Watching… tap to identify"}
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="text-teal-300">
                <path d="M3 7.5L6 4.5L9 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {/* Radar-ping the creature's current location on the clip. */}
            {hasBboxes && (
              <button
                type="button"
                onClick={triggerPing}
                aria-label="Show where the creature is on screen"
                title="Show where on screen"
                className="flex shrink-0 items-center justify-center gap-1.5 border-l border-white/10 px-4 text-[11px] font-semibold uppercase tracking-wider text-teal-300 transition-colors hover:bg-white/5"
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="2" fill="currentColor" />
                  <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.3" opacity="0.7" />
                  <circle cx="8" cy="8" r="7.2" stroke="currentColor" strokeWidth="1.1" opacity="0.4" />
                </svg>
                <span className="hidden sm:inline">Show on screen</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating glass panel — Claude-style input or stats card. Hidden while a
          gate (shape or body) is open so only the gate box shows, not two. */}
      <AnimatePresence>
        {!panelCollapsed && !shapeGateOpen && !bodyGateOpen && (
          <div
            className="pointer-events-none absolute z-20 w-[min(480px,calc(100%-1rem))] lg:w-[min(420px,calc(40%-1rem))]"
            style={
              isLg
                ? { top: "50%", right: "1.25rem", left: "auto", transform: "translateY(-50%)" }
                : isDesktop
                  ? { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
                  : {
                      // +3.5rem clears the docked 56px "Name this species" bar.
                      bottom: `calc(${keyboardOffset}px + 3.5rem + max(0.5rem, env(safe-area-inset-bottom)))`,
                      left: "50%",
                      transform: "translateX(-50%)",
                    }
            }
          >
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
            transition={TRANSITION.standard}
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            dragElastic={0.08}
            dragConstraints={articleRef}
            className="pointer-events-auto relative flex max-h-[min(50vh,calc(100%-3.5rem))] w-full flex-col overflow-hidden rounded-card border border-white/12 bg-navy-900/72 backdrop-blur-md backdrop-saturate-150 md:max-h-[min(80vh,calc(100%-3.5rem))]"
          >
            {/* Drag-only-from-here button. Visible grip so users know it's the
                drag affordance. dragListener=false on the parent means drag
                cannot start anywhere else. */}
            <button
              type="button"
              onPointerDown={(e) => dragControls.start(e)}
              aria-label="Drag to reposition panel"
              className="absolute left-1/2 top-0 z-10 flex h-11 w-11 -translate-x-1/2 cursor-grab touch-none items-center justify-center text-white/35 transition-colors hover:text-white/75 active:cursor-grabbing"
            >
              <span className="flex h-6 w-9 items-center justify-center rounded-full hover:bg-white/10">
                <svg width="14" height="6" viewBox="0 0 14 6" fill="currentColor" aria-hidden="true">
                  <circle cx="2" cy="1.5" r="1" />
                  <circle cx="7" cy="1.5" r="1" />
                  <circle cx="12" cy="1.5" r="1" />
                  <circle cx="2" cy="4.5" r="1" />
                  <circle cx="7" cy="4.5" r="1" />
                  <circle cx="12" cy="4.5" r="1" />
                </svg>
              </span>
            </button>
            <button
              type="button"
              onClick={() => togglePanel(true)}
              aria-label="Minimize panel to see video (press H)"
              title="Minimize — press H to toggle"
              className="absolute right-1.5 top-1 z-10 inline-flex h-8 items-center gap-1 rounded-full bg-white/5 px-2 text-[10px] font-medium uppercase tracking-wider text-white/70 transition-colors hover:bg-white/15 hover:text-white"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2.5 6h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <span className="hidden sm:inline">Hide</span>
            </button>
            <div className="overflow-y-auto overscroll-contain px-3 pt-1 pb-2 md:px-4 md:pb-3" style={{ paddingBottom: `max(0.5rem, env(safe-area-inset-bottom))` }}>

              {!showStats ? (
                <>
                  {submitError && (
                    <p
                      id={`species-error-${snippet.id}`}
                      role="alert"
                      className="mb-1.5 text-[11px] font-medium text-red-300"
                    >
                      {submitError}
                    </p>
                  )}

                  {/* S2-T14 / (3 Jun): the MCQ candidate picker is now the
                       "skip to guess" fallback, gated behind guessMode — it is
                       no longer the first thing shown. The default identify path
                       is the step-by-step Spot It shape flow. The legacy free-text
                       input is still retained inside it via the DEGENERATE fallback. */}
                  {guessMode && (
                  <MCQCandidatePicker
                    snippetId={snippet.id}
                    isSignedIn={!!session}
                    submitting={submitting}
                    onPick={(name) => {
                      if (!name) {
                        // Sign-in nudge path inside the picker.
                        window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(`/feed`)}`;
                        return;
                      }
                      void submitAndAdvance(() =>
                        handleSubmit({ answerText: name }),
                      );
                    }}
                    freeTextFallback={
                      <>
                        <div className="flex items-center gap-2 pb-2">
                          {/* S5-T10: visually-hidden label so the
                               input has a programmatic name, not just
                               a placeholder. */}
                          <label
                            htmlFor={`species-answer-${snippet.id}`}
                            className="sr-only"
                          >
                            Species name
                          </label>
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
                          <motion.button
                            type="button"
                            onClick={handleConfirmAndAdvance}
                            disabled={!answerText.trim() || submitting}
                            aria-busy={submitting}
                            aria-label="Submit answer"
                            whileTap={!submitting && answerText.trim() && !reduceMotion ? { scale: 0.93 } : undefined}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-500 text-navy-900 transition-colors hover:bg-teal-400 disabled:cursor-not-allowed disabled:bg-teal-500/30 disabled:text-navy-900/60"
                          >
                            {submitting ? (
                              <svg width="14" height="14" viewBox="0 0 14 14" className={reduceMotion ? undefined : "animate-spin"} aria-hidden="true">
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
                              transition={TRANSITION.micro}
                              className="pb-1.5 text-[10px] text-white/40"
                            >
                              Press ↵ to submit · Skip to pass
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </>
                    }
                  />
                  )}

                  {hasNext && (
                    <div className="flex justify-end pb-1">
                      <button
                        type="button"
                        onClick={onAdvance}
                        // Q4-A-8: 44px touch target. Skip is the only
                        // way to bypass a card without submitting, so
                        // it must be tappable on mobile.
                        className="inline-flex min-h-[44px] items-center rounded-full px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-white/55 transition-colors hover:bg-white/8 hover:text-white/90"
                      >
                        Skip
                      </button>
                    </div>
                  )}

                  {status !== "loading" && !session && !showInputHint && (
                    <p className="pb-1.5 text-xs text-white/70">
                      <Link
                        href={`/auth/signin?callbackUrl=${encodeURIComponent(`/feed/${snippet.id}`)}`}
                        className="text-teal-50 underline underline-offset-2"
                      >
                        Sign in
                      </Link>{" "}
                      to save your answer and streak.
                    </p>
                  )}
                  {status !== "loading" && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pb-1.5">
                      {/* UX-0: "Spot It" gate entry — opens the shape-class
                          silhouette grid. Sits alongside (not replacing) the
                          existing "Help me identify" wizard trigger. */}
                      <button
                        type="button"
                        onClick={() => setShapeGateOpen(true)}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-teal-500/40 bg-teal-500/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-50 hover:border-teal-400 hover:bg-teal-500/20"
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
                          <path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                        </svg>
                        Spot It
                      </button>
                      {/* (3 Jun) The MCQ tile grid is now opt-in. This quiet link
                          lets a user who'd rather just pick from a list reveal it
                          without going through the shape gate first. */}
                      {!guessMode && (
                        <button
                          type="button"
                          onClick={() => setGuessMode(true)}
                          className="inline-flex min-h-[44px] items-center py-2 text-[11px] font-medium uppercase tracking-wider text-white/55 hover:text-white/90"
                        >
                          Pick from a list
                        </button>
                      )}
                      {/* (3 Jun fix) Single guided-ID entry is "Spot It" (above).
                          The older pre-submit "Help me identify" wizard trigger was
                          removed here — having both opened two concurrent guided
                          flows (ShapeGate + IdGuideSheet) that could stack. The
                          trait funnel / field-note teaching still lives in the
                          post-submit reveal trigger below (submitted={true}). */}
                      {hasLocation && (
                        <button
                          type="button"
                          onClick={() => setMapOpen(true)}
                          aria-label="Show where this clip was recorded on a map"
                          // F-PRESUBMIT-CTAS: ml-auto pushes this utility action
                          // to the far end of the row, separating it from the
                          // ID actions (Spot It / Help me identify). 44px target.
                          className="ml-auto inline-flex min-h-[44px] items-center gap-1 py-1.5 text-[10px] uppercase tracking-wider text-white/45 hover:text-white/80"
                        >
                          <svg width="11" height="11" viewBox="0 0 15 15" fill="none" aria-hidden="true" className="text-teal-500/80">
                            <path d="M7.5 1.5C5 1.5 3 3.4 3 5.9c0 3.4 4.5 7.6 4.5 7.6s4.5-4.2 4.5-7.6c0-2.5-2-4.4-4.5-4.4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
                            <circle cx="7.5" cy="5.9" r="1.5" fill="currentColor" />
                          </svg>
                          Where is this?
                        </button>
                      )}
                    </div>
                  )}

                  {/* UX-1: shrinking candidate strip. Appears once the gate has
                      set a shape class; lists the narrowed catalogue species as
                      tappable chips. Tapping commits via the same submit path as
                      the MCQ (onPick), so the unauth signin-carry is honoured. */}
                  {spotItActive && (
                    <CandidateStrip
                      shapeClass={selectedShape}
                      submitting={submitting}
                      onPick={(name) =>
                        void submitAndAdvance(() =>
                          handleSubmit({ answerText: name }),
                        )
                      }
                      onChangeShape={() => setShapeGateOpen(true)}
                      onSkipToMCQ={() => {
                        setSpotItActive(false);
                        setGuessMode(true);
                      }}
                      seed={formSeed ?? undefined}
                    />
                  )}
                </>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={
                      myAnswer!.isCorrect === null
                        ? "pending"
                        : myAnswer!.isCorrect
                          ? "correct"
                          : revealPartial
                            ? "partial"
                            : "wrong"
                    }
                    initial={
                      reduceMotion ? false : revealWrong ? { x: 0 } : { scale: 0.96, opacity: 0 }
                    }
                    animate={
                      reduceMotion
                        ? { opacity: 1 }
                        : revealWrong
                          ? { x: [0, -8, 8, -6, 6, 0] }
                          : { scale: 1, opacity: 1 }
                    }
                    transition={revealWrong ? { duration: 0.36 } : spring.cheer}
                    className="pb-2"
                  >
                    {/* S5-T9: aria-live announces the outcome to screen
                         readers; non-color cue (✓ / ✗ / + icons) so the
                         result doesn't rely on colour alone. S7-T2 contrast
                         pass: verdict pills are solid-bg + dark text so
                         they read against any underwater video background. */}
                    <p
                      className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm"
                      role="status"
                      aria-live="polite"
                    >
                      <span className="text-white/85">You said</span>
                      <span className="font-semibold text-white">
                        {myAnswer!.chosenOption}
                      </span>
                      {myAnswer!.isCorrect === true && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-correct px-2 py-0.5 text-[11px] font-bold tracking-wide text-correct-ink shadow-sm"
                          aria-label="Correct, plus 2 points"
                        >
                          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
                            <path d="M2 6.5l2.5 2.5L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Correct · +2
                        </span>
                      )}
                      {myAnswer!.isCorrect === false && (
                        <>
                          {revealPartial ? (
                            <>
                              <span
                                className="inline-flex items-center gap-1 rounded-full bg-pending px-2 py-0.5 text-[11px] font-bold tracking-wide text-pending-ink shadow-sm"
                                aria-label="Close, right shape class, plus 1 point"
                              >
                                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
                                  <path d="M2 4.5q1.5-1.6 3 0t3 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                  <path d="M2 8q1.5-1.6 3 0t3 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                                Close · +1
                              </span>
                              <span className="text-white/65">· right shape class</span>
                            </>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-incorrect px-2 py-0.5 text-[11px] font-bold tracking-wide text-incorrect-ink shadow-sm"
                              aria-label="Incorrect"
                            >
                              <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
                                <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              </svg>
                              Wrong
                            </span>
                          )}
                          {(stats!.staffAnswer ?? snippet.staffAnswer) && (
                            <span className="text-white/80">
                              ·{" "}
                              <span className="text-white/55">reference:</span>{" "}
                              <span className="font-semibold text-white">
                                {stats!.staffAnswer ?? snippet.staffAnswer}
                              </span>
                            </span>
                          )}
                        </>
                      )}
                      {myAnswer!.isCorrect === null && (
                        <>
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-pending px-2 py-0.5 text-[11px] font-bold tracking-wide text-pending-ink shadow-sm"
                            aria-label="Bonus, plus 1 point. Reference identification pending."
                          >
                            <svg viewBox="0 0 14 14" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
                              <path d="M7 1.5l1.6 3.5 3.8.4-2.8 2.6.8 3.7L7 10.4 3.4 12.2l.8-3.7L1.4 5.9l3.8-.4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                            </svg>
                            +1 Bonus
                          </span>
                          <span className="text-white/65">
                            · reference pending — your ID helps build the dataset
                          </span>
                        </>
                      )}
                    </p>
                    <div className="mt-1.5 space-y-0.5">
                      {stats!.stats.slice(0, 4).map((s) => (
                        <div key={s.option} className="flex items-center gap-1.5 text-[11px]">
                          <span className="w-16 truncate text-white/80">{s.option}</span>
                          <div className="h-1 flex-1 overflow-hidden rounded bg-white/10">
                            <div className="h-full rounded bg-teal-500/70" style={{ width: `${s.percent}%` }} />
                          </div>
                          <span className="w-7 text-right tabular-nums text-white/55">{s.percent}%</span>
                        </div>
                      ))}
                    </div>
                    {/* S7-T1: ecological-likelihood + species-gallery
                         panels only make sense when a reference ID
                         exists — they assess the user's guess against
                         the staff answer. On no-reference clips we
                         skip the whole pane and let the +1 bonus chip
                         carry the messaging. */}
                    {(() => {
                      const referenceAnswer =
                        stats!.staffAnswer ?? snippet.staffAnswer ?? null;
                      if (referenceAnswer === null) return null;
                      return (
                        <>
                          <RarityPanel
                            snippetId={snippet.id}
                            recordingDatetime={snippet.recordingDatetime}
                            userIsCorrect={myAnswer?.isCorrect === true}
                            onResolveStaffScientific={setStaffScientific}
                          />
                          {/* S2-T08 inline gallery — sits between the staff
                               answer line and the IdGuide trigger row.
                               SpeciesGallery hides itself silently when the
                               scientificName has no images (plaice larva,
                               catshark egg case) so the field-note sheet
                               remains the fallback for those species. */}
                          {staffScientific && (
                            <div className="mt-3">
                              {/* UX-4: diagnostic-mark rings on the reference photo.
                                  Returns null when no marks are authored yet, so
                                  SpeciesGallery below remains the fallback. */}
                              <AnnotatedSpeciesPhoto
                                scientificName={staffScientific}
                                commonName={referenceAnswer}
                              />
                              <SpeciesGallery
                                scientificName={staffScientific}
                                commonName={referenceAnswer}
                                size="thumb"
                              />
                              <p className="mt-1 text-[10px] text-white/60">
                                Photos: iNaturalist community, CC-licensed
                              </p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <IdGuideTrigger
                        snippetId={snippet.id}
                        submitted={true}
                        staffAnswer={
                          stats!.staffAnswer ?? snippet.staffAnswer ?? null
                        }
                        onSuggest={() => {}}
                        isLoggedIn={!!session}
                      />
                      {hasLocation && (
                        <button
                          type="button"
                          onClick={() => setMapOpen(true)}
                          aria-label="Show where this clip was recorded on a map"
                          className="inline-flex min-h-[36px] items-center gap-1 py-1.5 text-[10px] uppercase tracking-wider text-white/45 hover:text-white/80"
                        >
                          <svg width="11" height="11" viewBox="0 0 15 15" fill="none" aria-hidden="true" className="text-teal-500/80">
                            <path d="M7.5 1.5C5 1.5 3 3.4 3 5.9c0 3.4 4.5 7.6 4.5 7.6s4.5-4.2 4.5-7.6c0-2.5-2-4.4-4.5-4.4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
                            <circle cx="7.5" cy="5.9" r="1.5" fill="currentColor" />
                          </svg>
                          Where is this?
                        </button>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={editAnswer}
                          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/55 hover:text-white/90"
                        >
                          <svg viewBox="0 0 14 14" className="h-3 w-3 text-teal-500/80" fill="none" aria-hidden="true">
                            <path d="M9.3 2.4l2.3 2.3-6.4 6.4-2.8.5.5-2.8z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                          </svg>
                          Edit answer
                        </button>
                        <Link href="/feed/browse" className="text-[10px] uppercase tracking-wider text-white/45 hover:text-white/80">
                          Archive
                        </Link>
                      </div>
                      {hasNext ? (
                        <motion.button
                          type="button"
                          // Q4-A-10: this is now the canonical advance
                          // path. Triggers move-to-back via onAnswered
                          // AND scrolls to the next card via onAdvance.
                          onClick={handleAdvanceFromReveal}
                          whileTap={reduceMotion ? undefined : { scale: 0.95 }}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-teal-500 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-teal-400"
                        >
                          Next
                          <svg width="12" height="12" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                            <path d="M2 5h6M6 2.5L8.5 5L6 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </motion.button>
                      ) : (
                        /* S2-T15: terminal CTA when there's no next clip. */
                        <Link
                          href="/leaderboard"
                          className="inline-flex items-center gap-1.5 rounded-full bg-teal-500 px-3 py-1.5 text-xs font-semibold text-navy-900 hover:bg-teal-400"
                        >
                          See leaderboard
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                            <path d="M2 5h6M6 2.5L8.5 5L6 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </Link>
                      )}
                    </div>
                    {!hasNext && (
                      <div className="mt-3 rounded-card border border-white/12 bg-white/5 p-3 text-center">
                        <p className="text-xs font-semibold uppercase tracking-eyebrow text-teal-50">
                          You&apos;ve reached the end of the feed
                        </p>
                        <p className="mt-1 text-[11px] text-white/70">
                          Browse the archive to see what you missed, or start over.
                        </p>
                        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                          <Link
                            href="/feed/browse"
                            className="rounded-full border border-white/30 px-3 py-1 text-[11px] font-semibold text-white hover:border-teal-500"
                          >
                            Browse archive
                          </Link>
                          <Link
                            href="/feed"
                            className="rounded-full border border-white/30 px-3 py-1 text-[11px] font-semibold text-white hover:border-teal-500"
                          >
                            Start over
                          </Link>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </motion.aside>
          </div>
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

      {/* UX-0: Shape-class gate overlay. Sits above z-20 panel at z-30.
          onSelectShape activates the candidate strip — with a shape, or null
          ("Not sure" → strip narrows the whole catalogue, never dead-ends).
          onSkip closes the gate to the MCQ fast path ("skip to guess").
          onClose just dismisses, preserving any in-progress narrow. */}
      {shapeGateOpen && (
        <ShapeGate
          onSelectShape={(shape) => {
            setSelectedShape(shape);
            setFormSeed(null);
            setShapeGateOpen(false);
            // Rung 2: if this class has a discriminating body-shape sub-split,
            // show the body gate next; otherwise go straight to the strip.
            if (shape && bodyFormConfigFor(shape)) {
              setBodyGateOpen(true);
            } else {
              setSpotItActive(true);
            }
          }}
          onSkip={() => {
            // "Skip to guess" — reveal the MCQ tile grid as the fallback.
            setShapeGateOpen(false);
            setGuessMode(true);
          }}
          onClose={() => setShapeGateOpen(false)}
        />
      )}

      {/* Rung 2: body-shape gate. Same draggable dark card as Rung 1; the clip
          keeps playing behind it. Picking a form seeds the strip's narrowing. */}
      {bodyGateOpen && selectedShape && (
        <BodyShapeGate
          shapeClass={selectedShape}
          onSelectForm={(key, value) => {
            setFormSeed({ key, value });
            setBodyGateOpen(false);
            setSpotItActive(true);
          }}
          onSkip={() => {
            setBodyGateOpen(false);
            setGuessMode(true);
          }}
          onClose={() => setBodyGateOpen(false)}
        />
      )}
    </article>
  );
}
