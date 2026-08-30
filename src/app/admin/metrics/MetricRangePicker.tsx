"use client";

import { useState } from "react";
import type { MetricRangePreset } from "@/lib/metrics/range";

/**
 * The date-range control for /admin/metrics.
 *
 * It navigates rather than fetching. The range lives in the URL, the page is a
 * server component, so the server renders the right numbers first time and
 * there is no window where the cards show one range and the charts another.
 * The parent owns the transition, so the whole dashboard dims as one while the
 * new range loads instead of blanking the page on every click.
 */

const PRESETS: Array<{ value: Exclude<MetricRangePreset, "custom">; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "12m", label: "12 months" },
  { value: "all", label: "All time" },
];

export interface MetricRangePickerProps {
  preset: MetricRangePreset;
  /** Resolved span, e.g. "1 - 30 Aug 2026". */
  label: string;
  fromDay: string;
  toDay: string;
  /** Today, as a UTC day key: the latest date either input may hold. */
  todayDay: string;
  pending: boolean;
  /** Hands the parent the query string that reproduces the chosen range. */
  onSelect: (query: string) => void;
}

export function MetricRangePicker({
  preset,
  label,
  fromDay,
  toDay,
  todayDay,
  pending,
  onSelect,
}: MetricRangePickerProps) {
  const [showCustom, setShowCustom] = useState(preset === "custom");
  const [from, setFrom] = useState(fromDay);
  const [to, setTo] = useState(toDay);

  const customValid = from !== "" && to !== "" && from <= to;

  return (
    <div className="rounded-card border border-navy-200/60 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-eyebrow text-navy-600">
          Range
        </span>
        {PRESETS.map((p) => {
          const active = preset === p.value;
          return (
            <button
              key={p.value}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setShowCustom(false);
                onSelect(`range=${p.value}`);
              }}
              className={`inline-flex h-11 items-center rounded-full px-4 text-sm font-medium transition ${
                active ? "bg-teal-600 text-white" : "bg-navy-100 text-navy-700 hover:bg-navy-200"
              }`}
            >
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={preset === "custom"}
          aria-expanded={showCustom}
          onClick={() => setShowCustom((v) => !v)}
          className={`inline-flex h-11 items-center rounded-full px-4 text-sm font-medium transition ${
            preset === "custom"
              ? "bg-teal-600 text-white"
              : "bg-navy-100 text-navy-700 hover:bg-navy-200"
          }`}
        >
          Custom
        </button>
        <span
          className="ml-auto text-[12px] text-navy-600"
          aria-live="polite"
          data-pending={pending ? "" : undefined}
        >
          {pending ? "Loading..." : label}
        </span>
      </div>

      {showCustom && (
        <form
          className="mt-3 flex flex-wrap items-end gap-3 border-t border-navy-200/60 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (customValid) onSelect(`range=custom&from=${from}&to=${to}`);
          }}
        >
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-eyebrow text-navy-600">
            From
            <input
              type="date"
              value={from}
              max={to || todayDay}
              onChange={(e) => setFrom(e.target.value)}
              className="h-11 rounded-modal border border-navy-200 bg-white px-3 text-sm font-normal normal-case tracking-normal text-navy-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-eyebrow text-navy-600">
            To
            <input
              type="date"
              value={to}
              min={from || undefined}
              max={todayDay}
              onChange={(e) => setTo(e.target.value)}
              className="h-11 rounded-modal border border-navy-200 bg-white px-3 text-sm font-normal normal-case tracking-normal text-navy-900"
            />
          </label>
          <button
            type="submit"
            disabled={!customValid}
            className="inline-flex h-11 items-center rounded-full bg-teal-600 px-5 text-sm font-semibold text-white transition hover:bg-teal-hover disabled:cursor-not-allowed disabled:bg-navy-200 disabled:text-navy-500"
          >
            Apply
          </button>
          {!customValid && (
            <p className="text-[11px] text-navy-600">Pick a start date on or before the end date.</p>
          )}
        </form>
      )}
    </div>
  );
}
