"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useCreatureQuiz } from "@/lib/useCreatureQuiz";
import { usePortraitFishPan } from "@/lib/usePortraitFishPan";

const OPTIONS = ["Fish", "Crab", "Jellyfish", "Flatfish", "Gastropod", "Scooter", "Other"];

interface SnippetPlayerProps {
  snippet: {
    id: string;
    videoUrl: string;
    thumbnailUrl: string;
    site: string;
    deployment: string;
    depthM: number | null;
    recordingDatetime: string | null;
    staffAnswer: string;
    bboxes: Array<{ frame_clip: number; x_norm: number; y_norm: number; w_norm: number; h_norm: number }> | null;
  };
}

export function SnippetPlayer({ snippet }: SnippetPlayerProps) {
  const { videoRef, videoStyle, panEnabled } = usePortraitFishPan(snippet.bboxes);
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
  } = useCreatureQuiz(snippet, `/feed/${snippet.id}`);

  const showStats = myAnswer && stats;

  return (
    <div className="space-y-6">
      <div className="rounded-xl overflow-hidden border border-slate-700/50 bg-slate-900 aspect-[9/16] max-h-[70vh] mx-auto relative">
        <video
          ref={videoRef}
          src={snippet.videoUrl}
          poster={snippet.thumbnailUrl}
          controls
          style={videoStyle}
          className={`w-full h-full ${panEnabled ? "object-cover" : "object-contain"}`}
          playsInline
        />
      </div>

      <div className="text-sm text-slate-400">
        <p>{snippet.site}</p>
        <p>{snippet.deployment}</p>
        {snippet.depthM != null && <p>Depth: {snippet.depthM}m</p>}
        {snippet.recordingDatetime && <p>Recorded: {snippet.recordingDatetime}</p>}
      </div>

      <div>
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
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition ${
                    selected === opt
                      ? "bg-cyan-500 text-slate-900 border-cyan-500"
                      : "border-slate-600 text-slate-300 hover:border-slate-500"
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
                className="w-full max-w-md px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 text-white placeholder-slate-500 mb-3"
              />
            )}
            <motion.button
              type="button"
              onClick={handleSubmit}
              disabled={!selected || submitting}
              whileTap={!submitting && selected ? { scale: 0.97 } : undefined}
              className="bg-cyan-500 text-slate-900 font-semibold px-6 py-3 rounded-lg hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting…" : "Submit answer"}
            </motion.button>
            {status !== "loading" && !session && (
              <p className="mt-2 text-slate-500 text-sm">
                <Link href={`/auth/signin?callbackUrl=${encodeURIComponent(`/feed/${snippet.id}`)}`} className="text-cyan-400 underline">
                  Sign in
                </Link> to submit and appear on the leaderboard.
              </p>
            )}
          </>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={myAnswer.isCorrect ? "correct" : "wrong"}
              initial={myAnswer.isCorrect ? { scale: 0.9, opacity: 0 } : { x: 0 }}
              animate={
                myAnswer.isCorrect
                  ? { scale: 1, opacity: 1 }
                  : { x: [0, -10, 10, -8, 8, 0] }
              }
              transition={
                myAnswer.isCorrect
                  ? { type: "spring", stiffness: 300, damping: 20 }
                  : { duration: 0.4 }
              }
              className="space-y-4"
            >
              <p className="text-cyan-400 font-medium">
                You said: {myAnswer.chosenOption}{" "}
                {myAnswer.isCorrect && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, delay: 0.1 }}
                  >
                    ✓ Correct!
                  </motion.span>
                )}
              </p>
              <div>
                <h3 className="font-medium mb-2">What the community said</h3>
                <ul className="space-y-1">
                  {stats.stats.map((s) => (
                    <li key={s.option} className="flex items-center gap-2">
                      <span className="w-24">{s.option}</span>
                      <span className="text-slate-400">{s.percent}%</span>
                      <div className="flex-1 h-2 bg-slate-700 rounded overflow-hidden max-w-[200px]">
                        <div className="h-full bg-cyan-500 rounded" style={{ width: `${s.percent}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="text-slate-500 text-sm mt-2">PEBL label: {stats.staffAnswer}</p>
              </div>
              <Link href="/feed" className="inline-block text-cyan-400 hover:underline">
                ← Back to feed
              </Link>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
