"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { MetricRangePicker } from "./MetricRangePicker";
import { MetricTrendChart } from "./MetricTrendChart";
import { formatMetricValue, metricDelta } from "@/lib/metrics/format";
import { METRIC_SECTIONS, type MetricSeries } from "@/lib/metrics/series";
import type { MetricRangePreset } from "@/lib/metrics/range";

/**
 * The interactive shell over the server-rendered metrics.
 *
 * It owns exactly two pieces of state: which card is expanded, and the pending
 * flag while a new range loads. Everything else arrives already computed from
 * the server, so the first paint is the real dashboard rather than an empty
 * frame a mount effect fills in.
 */

export interface TopSourceRow {
  label: string;
  count: number;
}

export interface MetricsDashboardProps {
  series: MetricSeries[];
  days: string[];
  preset: MetricRangePreset;
  rangeLabel: string;
  fromDay: string;
  toDay: string;
  todayDay: string;
  previousTotals: Record<string, number | null> | null;
  previousLabel: string | null;
  firstEventDay: string | null;
  topSources: TopSourceRow[];
  exportHref: string;
  /** The requested range was invalid or too long and was adjusted. */
  coerced: boolean;
}

export function MetricsDashboard({
  series,
  days,
  preset,
  rangeLabel,
  fromDay,
  toDay,
  todayDay,
  previousTotals,
  previousLabel,
  firstEventDay,
  topSources,
  exportHref,
  coerced,
}: MetricsDashboardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const idPrefix = useId();

  const byKey = new Map(series.map((s) => [s.key, s]));
  const anyEventDerived = series.some((s) => s.eventDerived);

  const select = (query: string) => {
    // Collapse first: the open card's chart belongs to the old range, and
    // leaving it up while the new one loads shows two ranges at once.
    setOpenKey(null);
    startTransition(() => router.push(`/admin/metrics?${query}`, { scroll: false }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-brand text-lg font-semibold text-navy-900">Impact metrics</h1>
          <p className="mt-1 max-w-2xl text-[12px] text-navy-600">
            Aggregate engagement and learning for funder reporting. Pick a range, then open any
            card for its day-by-day trend.
          </p>
        </div>
        <Link
          href={exportHref}
          className="pebl-button-secondary inline-flex h-11 items-center rounded-full px-4 text-xs font-semibold"
        >
          Export CSV (this range)
        </Link>
      </div>

      <MetricRangePicker
        preset={preset}
        label={rangeLabel}
        fromDay={fromDay}
        toDay={toDay}
        todayDay={todayDay}
        pending={pending}
        onSelect={select}
      />

      {coerced && (
        <p className="rounded-modal border border-navy-200 bg-navy-50 px-3 py-2 text-[12px] text-navy-700">
          That range could not be used as asked for, so it was adjusted to {rangeLabel}.
        </p>
      )}

      <div
        className={`space-y-8 transition-opacity ${pending ? "pointer-events-none opacity-50" : ""}`}
        aria-busy={pending}
      >
        {METRIC_SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-eyebrow text-navy-600">
              {section.title}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {section.keys.map((key) => {
                const metric = byKey.get(key);
                if (!metric) return null;
                const panelId = `${idPrefix}-panel-${key}`;
                const buttonId = `${idPrefix}-card-${key}`;
                const open = openKey === key;
                return (
                  <MetricCardAndPanel
                    key={key}
                    metric={metric}
                    days={days}
                    open={open}
                    panelId={panelId}
                    buttonId={buttonId}
                    firstEventDay={firstEventDay}
                    previous={previousTotals ? (previousTotals[key] ?? null) : null}
                    previousLabel={previousLabel}
                    onToggle={() => setOpenKey(open ? null : key)}
                  />
                );
              })}
            </div>
          </section>
        ))}

        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-eyebrow text-navy-600">
            Top sources
          </h2>
          {topSources.length === 0 ? (
            <p className="text-[12px] text-navy-600">No sessions with attribution in this range.</p>
          ) : (
            <div className="rounded-card border border-navy-200/60 bg-white p-4">
              <ul className="divide-y divide-navy-200/60">
                {topSources.map((s) => (
                  <li
                    key={s.label}
                    className="flex items-center justify-between py-2 text-[13px]"
                  >
                    <span className="text-navy-900">{s.label}</span>
                    <span className="font-semibold tabular-nums text-navy-900">
                      {s.count.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {anyEventDerived && (
          <p className="text-[11px] text-navy-600">
            <AnalyticsDot />
            These come from the analytics log, so they count only spotters who accepted analytics
            and only from the day that log starts. Signups and identifications are complete back to
            launch.
          </p>
        )}
      </div>
    </div>
  );
}

function AnalyticsDot({ className = "" }: { className?: string }) {
  return (
    <span
      className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-teal-500 align-middle ${className}`}
      aria-hidden="true"
    />
  );
}

interface CardProps {
  metric: MetricSeries;
  days: string[];
  open: boolean;
  panelId: string;
  buttonId: string;
  firstEventDay: string | null;
  previous: number | null;
  previousLabel: string | null;
  onToggle: () => void;
}

function MetricCardAndPanel({
  metric,
  days,
  open,
  panelId,
  buttonId,
  firstEventDay,
  previous,
  previousLabel,
  onToggle,
}: CardProps) {
  const delta = metricDelta(metric.total, previous);
  return (
    <>
      <button
        type="button"
        id={buttonId}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={`rounded-card border bg-white p-4 text-left transition hover:border-teal-500 ${
          open ? "border-teal-500 ring-1 ring-teal-500" : "border-navy-200/60"
        }`}
      >
        <span className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-eyebrow text-teal-600">
            {metric.eventDerived && <AnalyticsDot />}
            {metric.label}
            {metric.eventDerived && (
              <span className="sr-only"> (from the analytics log, consent-gated)</span>
            )}
          </span>
          <Chevron open={open} />
        </span>
        <span className="mt-1 block text-2xl font-semibold tabular-nums text-navy-900">
          {formatMetricValue(metric.total, metric.unit)}
        </span>
        <span className="mt-0.5 block text-[11px] text-navy-600">{metric.sub}</span>
        {delta && (
          <span
            className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              delta.direction === "up"
                ? "bg-teal-50 text-teal-700"
                : delta.direction === "down"
                  ? "bg-danger/10 text-danger"
                  : "bg-navy-100 text-navy-600"
            }`}
          >
            <DeltaArrow direction={delta.direction} />
            {delta.text}
            <span className="sr-only">
              {delta.description}
              {previousLabel ? `, comparing with ${previousLabel}` : ""}
            </span>
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={buttonId}
          className="col-span-full rounded-card border border-teal-500/40 bg-white p-4"
        >
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-navy-900">
              {metric.label}, day by day
            </h3>
            {previousLabel && delta && (
              <p className="text-[11px] text-navy-600">
                {delta.text === "new" ? "No activity in" : `${delta.text} on`} the previous period (
                {previousLabel})
              </p>
            )}
          </div>
          <MetricTrendChart series={metric} days={days} firstEventDay={firstEventDay} />
          {!metric.totalIsSumOfDays && metric.shape === "bars" && (
            <p className="mt-2 text-[11px] text-navy-600">
              These daily figures are not meant to be added up. The headline above is worked out
              across the whole range, not summed from the days. See the note below.
            </p>
          )}
        </div>
      )}
    </>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-4 w-4 shrink-0 text-navy-400 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6.5 8 10.5 12 6.5" />
    </svg>
  );
}

function DeltaArrow({ direction }: { direction: "up" | "down" | "flat" }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className="h-3 w-3"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {direction === "flat" ? (
        <path d="M2 6h8" />
      ) : direction === "up" ? (
        <path d="M6 10V2M2.5 5.5 6 2l3.5 3.5" />
      ) : (
        <path d="M6 2v8M2.5 6.5 6 10l3.5-3.5" />
      )}
    </svg>
  );
}
