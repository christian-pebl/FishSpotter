"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  formatAxisValue,
  formatDayKey,
  formatMetricAverage,
  formatMetricValue,
  niceCeiling,
  niceFloor,
} from "@/lib/metrics/format";
import { rollingAverage, type MetricSeries } from "@/lib/metrics/series";

/**
 * The day-by-day chart that drops down when an admin opens a metric card.
 *
 * Hand-drawn SVG rather than a charting dependency: the whole vocabulary here
 * is bars, one line and three gridlines, which is less code than configuring a
 * library and keeps the admin bundle free of one. `DistributionMap` on the
 * species guide made the same call for the same reason.
 *
 * Three things it deliberately does NOT do:
 *   - draw a zero for a day with no denominator (a ratio's blank day is a gap,
 *     not a collapse to nothing);
 *   - draw plain zeroes across days before the Event log existed (that period
 *     is shaded and labelled, because "not measured" and "nobody came" look
 *     identical otherwise, and one of them would libel the project in a funder
 *     report);
 *   - separate the bars from the trend line by hue alone, since the reader is
 *     colourblind: the line is near-black navy over mid-teal bars, so the two
 *     are told apart by lightness.
 */

const VB_W = 800;
const VB_H = 200;
const PAD_L = 46;
const PAD_R = 10;
const PAD_T = 12;
const PAD_B = 24;
const PLOT_W = VB_W - PAD_L - PAD_R;
const PLOT_H = VB_H - PAD_T - PAD_B;

/** Below this many days the raw bars read cleanly and a smoother adds nothing. */
const ROLLING_MIN_DAYS = 32;
const ROLLING_WINDOW = 7;

export interface MetricTrendChartProps {
  series: MetricSeries;
  /** UTC day keys, same length and order as `series.values`. */
  days: string[];
  /** First day the Event log covers, or null if nothing is logged yet. */
  firstEventDay: string | null;
}

export function MetricTrendChart({ series, days, firstEventDay }: MetricTrendChartProps) {
  const { values, unit, shape } = series;
  const n = days.length;
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const view = useMemo(() => {
    const finite = values.filter((v): v is number => v != null && Number.isFinite(v));
    const rawMax = finite.length ? Math.max(...finite) : 0;
    const rawMin = finite.length ? Math.min(...finite) : 0;
    // Percentages always get the full scale: a 40-to-60 axis would make an
    // ordinary wobble look like a cliff.
    const max = unit === "percent" ? 100 : niceCeiling(rawMax);
    // Bars have to start at zero or their heights lie. A running total does
    // not: floored at zero, a curve from 55 to 89 signups reads as flat.
    const min = shape === "line" && unit !== "percent" ? niceFloor(rawMin) : 0;
    const span = max - min || 1;
    const slot = PLOT_W / Math.max(n, 1);
    const gap = slot > 6 ? 2 : slot > 3 ? 1 : 0;
    const barW = Math.max(1, Math.min(30, slot - gap));
    // "Has data" means something actually happened, not merely that the days
    // exist: a range of measured zeroes should say so in words rather than
    // leave the reader staring at an empty plot wondering if it failed to load.
    const hasData = finite.some((v) => v !== 0);
    return { max, min, span, slot, barW, hasData, rawMax, rawMin };
  }, [values, unit, shape, n]);

  const y = useCallback(
    (v: number) => PAD_T + PLOT_H - ((v - view.min) / view.span) * PLOT_H,
    [view.min, view.span],
  );
  const centreX = useCallback((i: number) => PAD_L + (i + 0.5) * view.slot, [view.slot]);

  // Days before the Event log started carry no analytics at all. Only the
  // event-derived metrics are affected; signups and IDs are complete to launch.
  const unmeasuredDays = useMemo(() => {
    if (!series.eventDerived || !firstEventDay) return 0;
    let count = 0;
    while (count < n && days[count] < firstEventDay) count++;
    return count;
  }, [series.eventDerived, firstEventDay, days, n]);

  const smoothed = useMemo(() => {
    if (shape === "line" || unit === "percent" || n < ROLLING_MIN_DAYS) return null;
    // Nulls are genuine gaps in a ratio, but every series that reaches here is
    // a count, where a missing day really is zero activity.
    return rollingAverage(
      values.map((v) => v ?? 0),
      ROLLING_WINDOW,
    );
  }, [shape, unit, n, values]);

  const linePath = useMemo(() => {
    if (shape !== "line") return null;
    let d = "";
    values.forEach((v, i) => {
      if (v == null) return;
      d += `${d ? "L" : "M"}${centreX(i).toFixed(2)},${y(v).toFixed(2)}`;
    });
    return d || null;
  }, [shape, values, centreX, y]);

  const smoothedPath = useMemo(() => {
    if (!smoothed) return null;
    // Start the line where measurement starts. Run through the unmeasured days
    // and it draws a confident flat zero across exactly the period the shading
    // is there to say we know nothing about.
    const start = Math.min(unmeasuredDays, Math.max(0, n - 1));
    const points = smoothed.slice(start);
    if (points.length < 2) return null;
    return points
      .map((v, i) => `${i ? "L" : "M"}${centreX(start + i).toFixed(2)},${y(v).toFixed(2)}`)
      .join("");
  }, [smoothed, centreX, y, unmeasuredDays, n]);

  const gridValues = [view.min, view.min + view.span / 2, view.max];

  const tickIndices = useMemo(() => {
    if (n <= 1) return [0];
    const step = Math.max(1, Math.ceil(n / 5));
    const ticks: number[] = [];
    for (let i = 0; i < n - 1; i += step) ticks.push(i);
    // Drop a tick that would collide with the always-present last label.
    while (ticks.length && n - 1 - ticks[ticks.length - 1] < step / 2) ticks.pop();
    ticks.push(n - 1);
    return ticks;
  }, [n]);

  const summary = useMemo(() => {
    let peakIndex = -1;
    let peak = -Infinity;
    let acc = 0;
    let counted = 0;
    let latestIndex = -1;
    values.forEach((v, i) => {
      if (v == null || !Number.isFinite(v)) return;
      if (v > peak) {
        peak = v;
        peakIndex = i;
      }
      acc += v;
      counted++;
      latestIndex = i;
    });
    return {
      peakIndex,
      peak: peakIndex >= 0 ? peak : null,
      average: counted > 0 ? acc / counted : null,
      latestIndex,
      latest: latestIndex >= 0 ? (values[latestIndex] as number) : null,
    };
  }, [values]);

  const indexFromClientX = useCallback(
    (clientX: number): number | null => {
      const el = svgRef.current;
      if (!el || n === 0) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) return null;
      const vx = ((clientX - rect.left) / rect.width) * VB_W;
      const i = Math.floor((vx - PAD_L) / view.slot);
      return Math.min(n - 1, Math.max(0, i));
    },
    [n, view.slot],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (n === 0) return;
    const current = hover ?? n - 1;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setHover(Math.min(n - 1, current + 1));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setHover(Math.max(0, current - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setHover(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setHover(n - 1);
    } else if (e.key === "Escape") {
      setHover(null);
    }
  };

  const hoverValue = hover != null ? values[hover] : null;
  const tooltipPct =
    hover == null ? 0 : Math.min(96, Math.max(4, (centreX(hover) / VB_W) * 100));

  const ariaLabel = [
    `${series.label}, ${series.sub}, day by day from ${formatDayKey(days[0] ?? "", { withYear: true })}`,
    `to ${formatDayKey(days[n - 1] ?? "", { withYear: true })}.`,
    summary.peak != null && summary.peakIndex >= 0
      ? `Peak ${formatMetricValue(summary.peak, unit)} on ${formatDayKey(days[summary.peakIndex], { withYear: true })}.`
      : "No activity recorded.",
    summary.average != null ? `Daily average ${formatMetricValue(summary.average, unit)}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="h-auto w-full touch-none rounded-modal outline-none ring-teal-500 focus-visible:ring-2"
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerMove={(e) => setHover(indexFromClientX(e.clientX))}
          onPointerLeave={() => setHover(null)}
          onBlur={() => setHover(null)}
        >
          {/* Period with no analytics at all, shaded so its zeroes are not read
              as a measured absence of visitors. */}
          {unmeasuredDays > 0 && (
            <rect
              x={PAD_L}
              y={PAD_T}
              width={unmeasuredDays * view.slot}
              height={PLOT_H}
              className="fill-navy-100"
            />
          )}

          {gridValues.map((gv, i) => (
            <g key={i}>
              <line
                x1={PAD_L}
                x2={VB_W - PAD_R}
                y1={y(gv)}
                y2={y(gv)}
                className="stroke-navy-200"
                strokeWidth={1}
              />
              <text
                x={PAD_L - 8}
                y={y(gv) + 4}
                textAnchor="end"
                className="fill-navy-500 text-[11px] tabular-nums"
              >
                {formatAxisValue(gv, unit)}
              </text>
            </g>
          ))}

          {shape === "bars" &&
            values.map((v, i) =>
              v == null || v <= view.min ? null : (
                <rect
                  key={i}
                  x={PAD_L + i * view.slot + (view.slot - view.barW) / 2}
                  y={y(v)}
                  width={view.barW}
                  height={Math.max(1, PAD_T + PLOT_H - y(v))}
                  rx={view.barW > 5 ? 1.5 : 0}
                  className={hover === i ? "fill-teal-600" : "fill-teal-500"}
                />
              ),
            )}

          {linePath && (
            <>
              <path
                d={`${linePath}L${centreX(n - 1).toFixed(2)},${PAD_T + PLOT_H}L${centreX(0).toFixed(2)},${PAD_T + PLOT_H}Z`}
                className="fill-teal-500/15"
              />
              <path
                d={linePath}
                fill="none"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                className="stroke-teal-600"
              />
            </>
          )}

          {smoothedPath && (
            <path
              d={smoothedPath}
              fill="none"
              strokeWidth={1.75}
              strokeLinejoin="round"
              strokeLinecap="round"
              className="stroke-navy-900"
            />
          )}

          {hover != null && (
            <line
              x1={centreX(hover)}
              x2={centreX(hover)}
              y1={PAD_T}
              y2={PAD_T + PLOT_H}
              className="stroke-navy-400"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}
          {hover != null && hoverValue != null && (
            <circle cx={centreX(hover)} cy={y(hoverValue)} r={3} className="fill-navy-900" />
          )}

          <line
            x1={PAD_L}
            x2={VB_W - PAD_R}
            y1={PAD_T + PLOT_H}
            y2={PAD_T + PLOT_H}
            className="stroke-navy-300"
            strokeWidth={1}
          />
          {tickIndices.map((i) => (
            <text
              key={i}
              x={centreX(i)}
              y={VB_H - 8}
              textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
              className="fill-navy-500 text-[11px]"
            >
              {formatDayKey(days[i])}
            </text>
          ))}
        </svg>

        {hover != null && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-modal border border-navy-200 bg-white px-2.5 py-1.5 text-center shadow-chip"
            style={{ left: `${tooltipPct}%` }}
          >
            <p className="whitespace-nowrap text-[11px] text-navy-600">
              {formatDayKey(days[hover], { withYear: true })}
            </p>
            <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-navy-900">
              {hoverValue == null ? "no data" : formatMetricValue(hoverValue, unit)}
            </p>
          </div>
        )}
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-navy-600">
        <div className="flex gap-1.5">
          <dt>Peak</dt>
          <dd className="font-semibold tabular-nums text-navy-900">
            {summary.peak == null
              ? "-"
              : `${formatMetricValue(summary.peak, unit)} on ${formatDayKey(days[summary.peakIndex], { withYear: true })}`}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt>Daily average</dt>
          <dd className="font-semibold tabular-nums text-navy-900">
            {formatMetricAverage(summary.average, unit)}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt>Latest</dt>
          <dd className="font-semibold tabular-nums text-navy-900">
            {summary.latest == null
              ? "-"
              : `${formatMetricValue(summary.latest, unit)} on ${formatDayKey(days[summary.latestIndex], { withYear: true })}`}
          </dd>
        </div>
        {smoothedPath && (
          <div className="flex gap-1.5">
            <dt>Dark line</dt>
            <dd className="font-semibold text-navy-900">{ROLLING_WINDOW}-day average</dd>
          </div>
        )}
      </dl>

      {!view.hasData && (
        <p className="mt-2 text-[11px] text-navy-600">
          Nothing recorded for this metric in this range.
        </p>
      )}

      {unmeasuredDays > 0 && (
        <p className="mt-2 text-[11px] text-navy-600">
          <span className="mr-1.5 inline-block h-2.5 w-4 rounded-sm bg-navy-100 align-middle" />
          The shaded days are before analytics existed
          {firstEventDay ? ` (first logged ${formatDayKey(firstEventDay, { withYear: true })})` : ""}
          , so they are not measured zeroes.
        </p>
      )}

      {series.note && <p className="mt-2 text-[11px] text-navy-600">{series.note}</p>}
    </div>
  );
}
