"use client";

import Link from "next/link";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCreatureQuiz } from "@/lib/useCreatureQuiz";
import { usePortraitFishPan } from "@/lib/usePortraitFishPan";
import type { FeedSnippet } from "./FeedPlayer";

const OPTIONS = ["Fish", "Crab", "Jellyfish", "Flatfish", "Gastropod", "Scooter", "Other"];

interface FeedCardProps {
  snippet: FeedSnippet;
  isActive: boolean;
  preload: boolean;
}

export function FeedCard({ snippet, isActive, preload }: FeedCardProps) {
  const { videoRef, videoStyle } = usePortraitFishPan(snippet.bboxes);
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
          style={videoStyle}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent pt-8 pb-4 px-4">
          <p className="text-slate-300 text-xs mb-2">{snippet.site} · {snippet.deployment}</p>
          <h2 className="text-lg font-semibold mb-3">What is this creature?</h2>

          {!showStats ? (
            <>
              <div className="flex flex-wrap gap-2 mb-3">
                {OPTIONS.map((opt) => (
                  <motion.button
                    key={opt}
                    type="button"
                    onClick={() => setSelected(opt)}
                    whileTap={{ scale: 0.97 }}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition ${
                      selected === opt
                        ? "bg-cyan-500 text-slate-900 border-cyan-500"
                        : "border-slate-500 text-slate-200 hover:border-slate-400 bg-black/30"
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
                  className="w-full max-w-md px-3 py-2 rounded-lg border border-slate-500 bg-black/50 text-white placeholder-slate-400 mb-3 text-sm"
                />
              )}
              <motion.button
                type="button"
                onClick={handleSubmit}
                disabled={!selected || submitting}
                whileTap={!submitting && selected ? { scale: 0.97 } : undefined}
                className="bg-cyan-500 text-slate-900 font-semibold px-5 py-2 rounded-lg hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {submitting ? "Submitting…" : "Submit"}
              </motion.button>
              {status !== "loading" && !session && (
                <p className="mt-2 text-slate-400 text-xs">
                  <Link href={`/auth/signin?callbackUrl=${encodeURIComponent("/feed")}`} className="text-cyan-400 underline">
                    Sign in
                  </Link> to submit and earn streaks.
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
                className="space-y-2"
              >
                <p className="text-cyan-400 font-medium text-sm">
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
                  <p className="font-medium mb-1">Community</p>
                  <ul className="space-y-0.5">
                    {stats!.stats.slice(0, 4).map((s) => (
                      <li key={s.option} className="flex items-center gap-2">
                        <span className="w-20">{s.option}</span>
                        <span className="text-slate-400">{s.percent}%</span>
                        <div className="flex-1 h-1.5 bg-slate-700 rounded overflow-hidden max-w-[120px]">
                          <div className="h-full bg-cyan-500 rounded" style={{ width: `${s.percent}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="text-slate-500 mt-1">PEBL: {stats!.staffAnswer}</p>
                </div>
                <p className="text-slate-400 text-xs mt-2">
                  Swipe up for next clip · <Link href="/feed/browse" className="text-cyan-400 underline">Browse all</Link>
                </p>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </>
  );
}
