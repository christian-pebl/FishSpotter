"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { DURATION } from "@/lib/motion";

type ProbabilityResponse =
  | {
      status: "OK";
      source: string;
      totalRecords: number;
      species: Array<{ scientificName: string; count: number; probability: number }>;
      // Omitted server-side until the user has submitted an Answer for this
      // snippet (S1-T11 answer-gate). Consumers must treat as optional.
      staffAnswerScientific?: string | null;
      fetchedAt: string;
    }
  | { status: "INSUFFICIENT_DATA" }
  | { status: "ERROR"; errorMessage?: string };

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthName(recordingDatetime: string | null | undefined): string | null {
  if (!recordingDatetime) return null;
  const d = new Date(recordingDatetime);
  if (Number.isNaN(d.getTime())) return null;
  return MONTH_NAMES[d.getUTCMonth()];
}

export function RarityPanel({
  snippetId,
  recordingDatetime,
  userIsCorrect,
  onResolveStaffScientific,
}: {
  snippetId: string;
  recordingDatetime: string | null | undefined;
  /** Only celebrate a rare find when the user actually got it right. */
  userIsCorrect: boolean;
  /** Fired once when /probability resolves with a scientific name. S2-T08
   *  uses this to render an inline SpeciesGallery in the reveal card
   *  without a second fetch of /probability. */
  onResolveStaffScientific?: (scientificName: string | null) => void;
}) {
  const [data, setData] = useState<ProbabilityResponse | null>(null);
  const [error, setError] = useState(false);
  const resolveRef = useRef(onResolveStaffScientific);
  useEffect(() => {
    resolveRef.current = onResolveStaffScientific;
  }, [onResolveStaffScientific]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/snippets/${snippetId}/probability`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ProbabilityResponse;
        if (cancelled) return;
        setData(json);
        if (json.status === "OK") {
          resolveRef.current?.(json.staffAnswerScientific ?? null);
        } else {
          resolveRef.current?.(null);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [snippetId]);

  // S2-T09: the rare-find second-fire was removed here — the celebration
  // (sound + confetti) now belongs to useCreatureQuiz and runs exactly
  // once per (user, snippet) per session. A future rare-find visual
  // upgrade can be wired via the same hook so the burst stays a single
  // event.

  if (error || !data) return null;
  if (data.status === "ERROR") return null;

  if (data.status === "INSUFFICIENT_DATA") {
    return (
      <div className="mt-2 text-[10px] text-white/40">
        Not enough OBIS data for this location and season yet.
      </div>
    );
  }

  // OK
  const month = monthName(recordingDatetime);
  const top = data.species.slice(0, 3);
  const staffSci = data.staffAnswerScientific;
  const staffMatch = staffSci ? data.species.find((s) => s.scientificName === staffSci) : null;
  const staffProb = staffMatch?.probability ?? null;

  let badge: { label: string; tone: "rare" | "common" } | null = null;
  if (staffProb != null) {
    if (staffProb < 0.05) badge = { label: "rare find", tone: "rare" };
    else if (staffProb > 0.25) badge = { label: "common here", tone: "common" };
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.standard, delay: 0.08 }}
      className="mt-3 border-t border-white/10 pt-2"
    >
      <div className="flex items-baseline justify-between gap-2 pb-1">
        <span className="text-[10px] uppercase tracking-wider text-white/55">
          Ecological likelihood
        </span>
        <span className="text-[9px] text-white/60">
          OBIS · ~11 km{month ? ` · ${month}` : ""}
        </span>
      </div>
      <div className="space-y-0.5">
        {top.map((s) => (
          <div key={s.scientificName} className="flex items-center gap-1.5 text-[11px]">
            <span className="w-24 truncate italic text-white/80">{s.scientificName}</span>
            <div className="h-1 flex-1 overflow-hidden rounded bg-white/10">
              <div
                className="h-full rounded bg-teal-500/55"
                style={{ width: `${Math.round(s.probability * 100)}%` }}
              />
            </div>
            <span className="w-7 text-right tabular-nums text-white/55">
              {Math.round(s.probability * 100)}%
            </span>
          </div>
        ))}
      </div>
      {staffProb != null && (
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
          <span className="italic text-white/70 truncate">
            Reference: {staffSci}
          </span>
          <div className="flex items-center gap-2">
            <span className="tabular-nums text-white/85">{Math.round(staffProb * 100)}%</span>
            {badge && (
              <span
                className={
                  badge.tone === "rare"
                    ? "inline-flex items-center gap-1 rounded-full bg-amber-300/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200"
                    : "inline-flex items-center gap-1 rounded-full bg-teal-500/20 px-2 py-0.5 text-[10px] font-semibold text-teal-500"
                }
                aria-label={badge.label}
              >
                {badge.tone === "rare" ? (
                  <svg viewBox="0 0 14 14" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
                    <path d="M7 1.5l1.6 3.5 3.8.4-2.8 2.6.8 3.7L7 10.4 3.4 12.2l.8-3.7L1.4 5.9l3.8-.4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
                    <path d="M2 6.5l2.5 2.5L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {badge.label}
              </span>
            )}
          </div>
        </div>
      )}
      {staffProb == null && (
        <div className="mt-1 text-[10px] text-white/60">
          Reference not matched to OBIS records here.
        </div>
      )}
    </motion.div>
  );
}
