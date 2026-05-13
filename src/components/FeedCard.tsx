"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCreatureQuiz } from "@/lib/useCreatureQuiz";
import { TaxonRevealPanel } from "./TaxonRevealPanel";
import { ClipLocationMap } from "./ClipLocationMap";
import { IdGuideButton } from "./id-guide/IdGuideButton";
import { IdGuideSheet } from "./id-guide/IdGuideSheet";
import { deriveIdGuidePrefill } from "@/lib/id-guide-prefill";
import type { BBoxFrame, FeedSnippet } from "./FeedPlayer";

function formatPlaceContext(snippet: FeedSnippet): string {
  const parts = [snippet.site];
  if (snippet.depthM != null) parts.push(`${snippet.depthM}m`);
  if (snippet.recordingDatetime) {
    const d = new Date(snippet.recordingDatetime);
    if (!isNaN(d.getTime())) {
      parts.push(d.toLocaleDateString("en-GB", { month: "short", year: "numeric" }));
    }
  }
  return parts.join(" · ");
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const TRACE_POINT_LIMIT = 22;
const MIN_HIGHLIGHT_SIZE = 28;

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

function getRenderedBox(video: HTMLVideoElement, bbox: BBoxFrame) {
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
  const width = Math.max(MIN_HIGHLIGHT_SIZE, Math.abs(bbox.w_norm) * renderedWidth);
  const height = Math.max(MIN_HIGHLIGHT_SIZE, Math.abs(bbox.h_norm) * renderedHeight);

  video.style.objectPosition = `${(objectX * 100).toFixed(2)}% ${(objectY * 100).toFixed(2)}%`;

  return {
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
    cx,
    cy,
    viewWidth: cw,
    viewHeight: ch,
  };
}

interface FeedCardProps {
  snippet: FeedSnippet;
  isActive: boolean;
  preload: boolean;
  hasNext: boolean;
  onAdvance: () => void;
}

export function FeedCard({ snippet, isActive, preload, hasNext, onAdvance }: FeedCardProps) {
  const [trackingOn, setTrackingOn] = useState<boolean>(true);
  const [guideOpen, setGuideOpen] = useState(false);

  // Initialise from localStorage and listen for cross-card changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("fishspotter:trackingOn");
    if (stored != null) setTrackingOn(stored === "1");
    const onChange = (e: Event) => {
      const v = (e as CustomEvent<boolean>).detail;
      if (typeof v === "boolean") setTrackingOn(v);
    };
    window.addEventListener("fishspotter:trackingChanged", onChange);
    return () => window.removeEventListener("fishspotter:trackingChanged", onChange);
  }, []);

  const toggleTracking = useCallback(() => {
    // Side effects (localStorage + event dispatch) MUST live outside the setState updater
    // otherwise React Strict Mode invokes the updater twice and flips the side effect twice,
    // landing on the original value. Read latest from storage rather than from `trackingOn`
    // closure to keep the callback stable.
    const current = (typeof window !== "undefined" && window.localStorage.getItem("fishspotter:trackingOn")) === "0" ? false : true;
    const next = !current;
    setTrackingOn(next);
    try { window.localStorage.setItem("fishspotter:trackingOn", next ? "1" : "0"); } catch {}
    window.dispatchEvent(new CustomEvent("fishspotter:trackingChanged", { detail: next }));
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const traceGlowRef = useRef<SVGPolylineElement>(null);
  const traceRef = useRef<SVGPolylineElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const dotHaloRef = useRef<SVGCircleElement>(null);
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
    editAnswer,
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

  /** Smart pre-fill suggestions for the ID Guide, derived from the bbox track. */
  const idGuidePrefill = useMemo(() => deriveIdGuidePrefill(bboxes), [bboxes]);

  useEffect(() => {
    if (!videoRef.current) return;
    if (isActive) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isActive]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const overlay = overlayRef.current;
    const traceGlow = traceGlowRef.current;
    const trace = traceRef.current;
    const dot = dotRef.current;
    const halo = dotHaloRef.current;

    if (!isActive || !trackingOn || bboxes.length === 0 || !overlay || !traceGlow || !trace || !dot || !halo) {
      video.style.objectPosition = "";
      if (overlay) overlay.style.opacity = "0";
      return;
    }

    let raf = 0;
    let points: Point[] = [];

    const tick = () => {
      const dur = video.duration;
      if (Number.isFinite(dur) && dur > 0) {
        const t = Math.min(Math.max(video.currentTime, 0), dur);
        const bbox = getBoxAtProgress(bboxes, t / dur);
        const rendered = bbox ? getRenderedBox(video, bbox) : null;
        if (rendered) {
          overlay.setAttribute("viewBox", `0 0 ${rendered.viewWidth} ${rendered.viewHeight}`);
          overlay.style.opacity = "1";

          dot.setAttribute("cx", rendered.cx.toFixed(2));
          dot.setAttribute("cy", rendered.cy.toFixed(2));
          halo.setAttribute("cx", rendered.cx.toFixed(2));
          halo.setAttribute("cy", rendered.cy.toFixed(2));

          const lastPoint = points[points.length - 1];
          if (!lastPoint || Math.hypot(lastPoint.x - rendered.cx, lastPoint.y - rendered.cy) > 2) {
            points = [...points, { x: rendered.cx, y: rendered.cy }].slice(-TRACE_POINT_LIMIT);
          }
          const pointString = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
          traceGlow.setAttribute("points", pointString);
          trace.setAttribute("points", pointString);
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bboxes, isActive, trackingOn]);

  const submitAndAdvance = useCallback(async (submit: () => Promise<boolean>) => {
    if (submitting) return;
    const didSubmit = await submit();
    if (didSubmit && hasNext) {
      window.setTimeout(onAdvance, 250);
    }
  }, [hasNext, onAdvance, submitting]);

  const handleConfirmAndAdvance = useCallback(async () => {
    if (!answerText.trim()) return;
    await submitAndAdvance(() => handleSubmit());
  }, [answerText, handleSubmit, submitAndAdvance]);

  const showStats = myAnswer && stats;
  const hasBboxes = bboxes.length > 0;

  return (
    <article className="flex h-full min-h-0 flex-col bg-[#17252A] text-white md:flex-row">
      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={snippet.videoUrl}
          poster={snippet.thumbnailUrl}
          muted
          playsInline
          loop
          preload={preload ? "auto" : "metadata"}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transition: "object-position 80ms linear" }}
        />
        {hasBboxes && trackingOn && (
          <svg
            ref={overlayRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full opacity-0 transition-opacity duration-150"
            preserveAspectRatio="none"
          >
            <polyline
              ref={traceGlowRef}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="6"
            />
            <polyline
              ref={traceRef}
              fill="none"
              stroke="rgba(255,255,255,0.22)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.25"
            />
            <circle
              ref={dotHaloRef}
              r="8"
              fill="rgba(255,255,255,0.08)"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="0.75"
            />
            <circle
              ref={dotRef}
              r="3"
              fill="rgba(255,255,255,0.55)"
              stroke="rgba(255,255,255,0.7)"
              strokeWidth="0.5"
            />
          </svg>
        )}
      </div>

      <aside className="max-h-[46vh] shrink-0 overflow-y-auto border-t border-white/10 bg-[#17252A] px-4 py-4 text-white md:max-h-none md:w-[360px] md:border-l md:border-t-0 md:px-5 md:py-5">
          {snippet.lat != null && snippet.lon != null && isActive && (
            <ClipLocationMap
              lat={snippet.lat}
              lon={snippet.lon}
              className="mb-3 h-32 w-full"
            />
          )}
          {snippet.lat != null && snippet.lon != null && !isActive && (
            <div className="mb-3 h-32 w-full rounded-xl bg-[#0e1a1d]" aria-hidden />
          )}
          <div className="mb-3 flex items-start justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#DEF2F1]">
              {formatPlaceContext(snippet)}
            </p>
            {snippet.labelStatus === "UNLABELLED" ? (
              <span className="shrink-0 rounded-full border border-orange-400/50 bg-orange-400/15 px-2 py-0.5 text-[10px] font-semibold text-orange-300">
                🟠 Help us ID · +5
              </span>
            ) : (
              <span className="shrink-0 rounded-full border border-[#3AAFA9]/50 bg-[#3AAFA9]/15 px-2 py-0.5 text-[10px] font-semibold text-[#3AAFA9]">
                🟢 Verified
              </span>
            )}
          </div>
          {hasBboxes && (
            <button
              type="button"
              onClick={toggleTracking}
              className="mb-3 flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/85 transition-colors hover:bg-white/[0.08]"
              aria-pressed={trackingOn}
              title={trackingOn ? "Hide tracker overlay" : "Show tracker overlay"}
            >
              <span className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span>Show tracker</span>
              </span>
              <span
                className={`relative inline-block h-5 w-9 shrink-0 rounded-full transition-colors duration-150 ${trackingOn ? "bg-[#3AAFA9]" : "bg-white/25"}`}
                aria-hidden
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150 ${trackingOn ? "translate-x-4" : "translate-x-0"}`}
                />
              </span>
            </button>
          )}
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
                className="mb-3 w-full rounded-2xl border border-white/30 bg-white px-3 py-2.5 text-sm text-[#17252A] outline-none placeholder:text-[#17252A]/55 focus:border-[#DEF2F1]"
                style={{ color: "#17252A", WebkitTextFillColor: "#17252A", caretColor: "#2B7A78" }}
              />
              <AnimatePresence>
                {correction && (
                  <motion.div
                    key="correction"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="mb-3 rounded-2xl border border-white/18 bg-white/10 p-3"
                  >
                    <p className="text-sm text-white/86">
                      Did you mean: <span className="font-semibold text-[#DEF2F1]">{correction.suggestion}</span>?
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <motion.button
                        type="button"
                        onClick={() => submitAndAdvance(acceptCorrection)}
                        whileTap={{ scale: 0.97 }}
                        className="rounded-full bg-[#DEF2F1] px-3 py-1.5 text-xs font-semibold text-[#17252A]"
                      >
                        Yes, use that
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={() => submitAndAdvance(submitOriginal)}
                        whileTap={{ scale: 0.97 }}
                        className="rounded-full border border-white/30 px-3 py-1.5 text-xs font-semibold text-white hover:border-[#3AAFA9]"
                      >
                        Use my answer
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {submitError && (
                <p className="mb-3 text-xs font-medium text-red-200">{submitError}</p>
              )}
              <motion.button
                type="button"
                onClick={handleConfirmAndAdvance}
                disabled={!answerText.trim() || submitting}
                whileTap={!submitting && answerText.trim() ? { scale: 0.97 } : undefined}
                className="w-full rounded-full bg-[#3AAFA9] px-4 py-2.5 text-sm font-semibold text-[#17252A] hover:bg-[#59c8c3] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {submitting
                  ? "Submitting…"
                  : hasNext
                    ? "Confirm and load next video"
                    : "Confirm selection"}
              </motion.button>
              {!correction && (
                <div className="mt-3 flex justify-center">
                  <IdGuideButton onClick={() => setGuideOpen(true)} />
                </div>
              )}
              {status !== "loading" && !session && (
                <p className="mt-2 text-xs text-white/75">
                  <Link href={`/auth/signin?callbackUrl=${encodeURIComponent("/feed")}`} className="text-[#DEF2F1] underline underline-offset-4">
                    Sign in
                  </Link> to record your answer and keep your PEBL streak alive.
                </p>
              )}
            </>
          ) : (
            <AnimatePresence mode="wait">
              <TaxonRevealPanel
                myAnswer={myAnswer!}
                stats={stats}
                hasNext={hasNext}
                onAdvance={onAdvance}
                onEdit={editAnswer}
              />
            </AnimatePresence>
          )}
      </aside>
      <IdGuideSheet
        open={guideOpen}
        snippetId={snippet.id}
        prefill={idGuidePrefill}
        onClose={() => setGuideOpen(false)}
        onConfirm={(taxonName) => {
          setGuideOpen(false);
          setAnswerText(taxonName);
          // Submit immediately with the resolved name; skipCorrection avoids "Did you mean?"
          void handleSubmit({ answerText: taxonName, skipCorrection: true });
        }}
      />
    </article>
  );
}
