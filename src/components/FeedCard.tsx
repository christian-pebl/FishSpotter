"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCreatureQuiz } from "@/lib/useCreatureQuiz";
import type { FeedSnippet } from "./FeedPlayer";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const OPTIONS = ["Fish", "Crab", "Jellyfish", "Flatfish", "Gastropod", "Scooter", "Other"];

interface FeedCardProps {
  snippet: FeedSnippet;
  isActive: boolean;
  preload: boolean;
}

export function FeedCard({ snippet, isActive, preload }: FeedCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const {
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
  } = useCreatureQuiz(snippet, "/feed");

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
    const bboxes = snippet.bboxes;
    if (!bboxes || bboxes.length === 0) {
      video.style.objectPosition = "";
      return;
    }
    let raf = 0;
    const tick = () => {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const cw = video.clientWidth;
      const ch = video.clientHeight;
      const dur = video.duration;
      if (vw && vh && cw && ch && Number.isFinite(dur) && dur > 0) {
        const t = Math.min(Math.max(video.currentTime, 0), dur);
        const idx = Math.min(
          bboxes.length - 1,
          Math.max(0, Math.floor((t / dur) * bboxes.length))
        );
        const bbox = bboxes[idx];
        const fx = bbox.x_norm + bbox.w_norm / 2;
        const fy = bbox.y_norm + bbox.h_norm / 2;
        const s = Math.max(cw / vw, ch / vh);
        const ovw = vw * s - cw;
        const ovh = vh * s - ch;
        const px = ovw > 0 ? clamp01((fx * vw * s - cw / 2) / ovw) : 0.5;
        const py = ovh > 0 ? clamp01((fy * vh * s - ch / 2) / ovh) : 0.5;
        video.style.objectPosition = `${(px * 100).toFixed(2)}% ${(py * 100).toFixed(2)}%`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [snippet.bboxes]);

  const showStats = myAnswer && stats;

  return (
    <>
      <div className="flex-1 min-h-0 relative overflow-hidden">
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
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#17252A]/95 via-[#17252A]/78 to-transparent px-4 pb-5 pt-12 text-white">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#DEF2F1]">
            {snippet.site} · {snippet.deployment}
          </p>
          <h2 className="font-brand-heading mb-3 text-2xl">Which marine group is in view?</h2>

          {!showStats ? (
            <>
              <div className="flex flex-wrap gap-2 mb-3">
                {OPTIONS.map((opt) => (
                  <motion.button
                    key={opt}
                    type="button"
                    onClick={() => setSelected(opt)}
                    whileTap={{ scale: 0.97 }}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      selected === opt
                        ? "border-[#DEF2F1] bg-[#DEF2F1] text-[#17252A]"
                        : "border-white/35 bg-[#17252A]/50 text-white hover:border-[#3AAFA9]"
                    }`}
                  >
                    {opt}
                  </motion.button>
                ))}
              </div>
              {selected === "Other" && (
                <input
                  type="text"
                  placeholder="Describe the creature"
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  className="mb-3 w-full max-w-md rounded-2xl border border-white/30 bg-white/12 px-3 py-2 text-sm text-white placeholder:text-white/60"
                />
              )}
              <motion.button
                type="button"
                onClick={handleSubmit}
                disabled={!selected || submitting}
                whileTap={!submitting && selected ? { scale: 0.97 } : undefined}
                className="rounded-full bg-[#3AAFA9] px-5 py-2 text-sm font-semibold text-[#17252A] hover:bg-[#59c8c3] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit observation"}
              </motion.button>
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
              <motion.div
                key={myAnswer!.isCorrect ? "correct" : "wrong"}
                initial={myAnswer!.isCorrect ? { scale: 0.9, opacity: 0 } : { x: 0 }}
                animate={
                  myAnswer!.isCorrect
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
                  <p className="mb-1 font-medium uppercase tracking-[0.14em] text-white/80">Community response</p>
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
                <p className="mt-2 text-xs text-white/75">
                  Swipe up for the next sighting · <Link href="/feed/browse" className="text-[#DEF2F1] underline underline-offset-4">Open archive</Link>
                </p>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </>
  );
}
