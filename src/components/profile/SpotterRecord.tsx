"use client";

import { useState } from "react";
import Image from "next/image";
import type { CategoryRecord, SpotterRecord as SpotterRecordData } from "@/lib/spotter-record";
import type { CategoryId } from "@/lib/badges";

/**
 * The Record: three categories, each with a count, a rank on that category's
 * leaderboard, three milestones, and an expandable list of the species behind
 * it.
 *
 * Client component because the species lists open on tap. The data is derived
 * server-side (src/lib/spotter-record.ts) and passed in whole, so opening a
 * panel costs no request.
 */

/** Stroked line icons, one per category. No emoji (see the UI rules). */
const ICONS: Record<CategoryId, React.ReactNode> = {
  pioneer: (
    <>
      <path d="M6 21V4.5" />
      <path d="M6 4.5h10l-2 3 2 3H6" />
    </>
  ),
  consensus: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </>
  ),
  pathfinder: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
};

function Milestones({ category }: { category: CategoryRecord }) {
  if (category.visible.length === 0) return null;
  return (
    <ul className="mt-3 flex items-center gap-1.5" aria-label="Milestones">
      {category.visible.map((m, i) => {
        const held = i < category.reached;
        return (
          <li
            key={m}
            title={held ? `${m} reached` : `Milestone at ${m}`}
            className={`flex-1 rounded-full px-2 py-1 text-center text-[10px] font-semibold tabular-nums ${
              held
                ? "bg-teal-600 text-white"
                : "bg-surface-muted text-navy-900/45"
            }`}
          >
            {m}
          </li>
        );
      })}
    </ul>
  );
}

function CategoryCard({
  category,
  open,
  onToggle,
}: {
  category: CategoryRecord;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = `record-panel-${category.id}`;
  return (
    <li className="rounded-card border border-navy-900/12 bg-surface">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-[44px] w-full flex-col items-start gap-1 rounded-card p-4 text-left transition-colors hover:bg-surface-muted/60"
      >
        <span className="flex w-full items-center gap-2">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0 text-teal-600"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {ICONS[category.id]}
          </svg>
          <span className="text-xs font-semibold uppercase tracking-eyebrow text-navy-900/70">
            {category.name}
          </span>
          <svg
            viewBox="0 0 24 24"
            className={`ml-auto h-4 w-4 shrink-0 text-navy-900/40 transition-transform ${
              open ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>

        <span className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums text-navy-900">
            {category.count}
          </span>
          {category.rank !== null && (
            <span className="text-xs font-medium text-teal-700">
              #{category.rank} of {category.rankOf}
            </span>
          )}
        </span>

        <span className="text-[11px] leading-snug text-navy-900/55">
          {category.blurb}
        </span>
      </button>

      <div className="px-4 pb-4">
        {/* progress toward the next milestone, only when one is in reach */}
        {category.nextAt !== null && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-teal-500"
              style={{ width: `${Math.round(category.progress * 100)}%` }}
            />
          </div>
        )}
        <Milestones category={category} />
        <p className="mt-2 text-[10px] text-navy-900/50">
          {category.nextAt !== null
            ? `${category.count} of ${category.nextAt} to the next milestone.`
            : category.hidden > 0
              ? "More milestones open up as new clips are added."
              : "Every milestone reached."}
        </p>

        {open && (
          <div id={panelId} className="mt-3 border-t border-navy-900/10 pt-3">
            <p className="text-[11px] leading-relaxed text-navy-900/55">
              {category.detail}
            </p>
            {category.species.length === 0 ? (
              <p className="mt-2 text-xs text-navy-900/55">Nothing here yet.</p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-2">
                {category.species.map((s) => (
                  <li
                    key={s.label}
                    className="flex items-center gap-2 rounded-full bg-surface-muted py-1 pl-1 pr-3"
                    title={s.scientificName ?? s.label}
                  >
                    <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-navy-900/10">
                      {s.thumbUrl && (
                        <Image
                          src={s.thumbUrl}
                          alt=""
                          fill
                          sizes="28px"
                          className="object-cover"
                        />
                      )}
                    </span>
                    <span className="text-[11px] font-medium text-navy-900">
                      {s.label}
                    </span>
                    {s.count > 1 && (
                      <span className="text-[10px] tabular-nums text-navy-900/50">
                        x{s.count}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export function SpotterRecord({ record }: { record: SpotterRecordData }) {
  const [open, setOpen] = useState<CategoryId | null>(null);

  const nothingYet =
    record.categories.every((c) => c.count === 0) && record.resolvedCalls === 0;

  return (
    <section className="pebl-surface rounded-card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="pebl-eyebrow">Record</p>
        {record.resolvedCalls > 0 && (
          <p className="text-xs font-medium text-navy-900/60">
            {record.counts.consensus} of {record.resolvedCalls} calls confirmed by
            the community
          </p>
        )}
      </div>

      {nothingYet ? (
        <p className="mt-3 text-sm leading-6 text-navy-900/60">
          Nothing here yet. These fill in when other spotters independently arrive
          at the same animal you named, so name a few clips and check back once
          the community catches up.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {record.categories.map((c) => (
            <CategoryCard
              key={c.id}
              category={c}
              open={open === c.id}
              onToggle={() => setOpen(open === c.id ? null : c.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
