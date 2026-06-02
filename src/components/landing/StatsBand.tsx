"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Live social-proof band: clips / species / spotters, count-up on first
 * scroll into view. Counts are passed in from the server (cheap DB
 * aggregates). Reduced-motion users see the final values immediately.
 */

type Stat = { value: number; label: string; suffix?: string };

function useCountUp(target: number, run: boolean, durationMs = 1100) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || target === 0) {
      setN(target);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const tick = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, durationMs]);
  return n;
}

export function StatsBand({ clips, species, spotters, speciesLabel = "species to spot" }: { clips: number; species: number; spotters: number; speciesLabel?: string }) {
  const [run, setRun] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRun(true);
          obs.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const stats: Stat[] = [
    { value: clips, label: "underwater clips" },
    { value: species, label: speciesLabel },
    { value: spotters, label: "spotters" },
  ];

  return (
    <div ref={ref} className="grid grid-cols-3 gap-3 text-center">
      {stats.map((s) => (
        <StatItem key={s.label} stat={s} run={run} />
      ))}
    </div>
  );
}

function StatItem({ stat, run }: { stat: Stat; run: boolean }) {
  const n = useCountUp(stat.value, run);
  return (
    <div className="pebl-surface rounded-card px-3 py-5">
      <p className="font-brand-heading text-3xl font-bold text-teal-700 md:text-4xl">
        {n.toLocaleString()}
        {stat.suffix ?? ""}
      </p>
      <p className="mt-1 text-xs text-navy-900/70 md:text-sm">{stat.label}</p>
    </div>
  );
}
