"use client";

/**
 * Per-snippet "How everyone answered" panel (light theme). A STAFF-ONLY review
 * view: it lists each spotter's name, their pick, and verdict, and links each
 * to their profile, so the team can learn why clips get answered right/wrong.
 *
 * The gate lives in GET /api/snippets/[id]/answers (admins @pebl-cic.co.uk
 * only). For everyone else the API returns { gated: true } and this renders
 * nothing — the public surfaces show only the anonymous aggregate stats.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

type AnswerRow = {
  id: string;
  isYou: boolean;
  userId: string;
  name: string;
  chosenOption: string;
  isCorrect: boolean | null;
  points: number;
};

type Payload =
  | { gated: true }
  | {
      gated: false;
      total: number;
      staffAnswer: string | null;
      hasReference: boolean;
      answers: AnswerRow[];
    };

function verdictOf(row: AnswerRow): { label: string; chip: string; dot: string } {
  if (row.isCorrect === true)
    return { label: "Correct", chip: "bg-correct text-correct-ink", dot: "bg-correct" };
  if (row.isCorrect === null)
    return { label: "Community", chip: "bg-pending text-pending-ink", dot: "bg-pending" };
  if (row.points > 0)
    // wrong species but right shape class (partial +1)
    return { label: "Close", chip: "bg-pending text-pending-ink", dot: "bg-pending" };
  return { label: "Missed", chip: "bg-incorrect text-incorrect-ink", dot: "bg-incorrect" };
}

function Row({ row }: { row: AnswerRow }) {
  const v = verdictOf(row);
  return (
    <li>
      <Link
        href={`/u/${row.userId}`}
        className="flex min-h-[44px] items-start gap-3 rounded-modal px-2 py-2 transition-colors hover:bg-navy-50"
      >
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${v.dot}`} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className={`truncate text-sm font-medium ${row.isYou ? "text-teal-700" : "text-navy-900"}`}>
              {row.name}
            </span>
            {row.isYou && (
              <span className="shrink-0 rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-800">
                You
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-navy-600">
            &ldquo;{row.chosenOption}&rdquo;
          </span>
        </span>
        <span className={`shrink-0 self-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${v.chip}`}>
          {v.label}
        </span>
      </Link>
    </li>
  );
}

export function SnippetAnswers({ snippetId }: { snippetId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/snippets/${snippetId}/answers`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Payload) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [snippetId]);

  // Non-admins (and the loading / error states) render nothing: this panel is
  // a staff-only overlay on top of the public anonymous stats.
  if (failed || data === null || data.gated) return null;

  return (
    <section className="mt-5 rounded-card border border-navy-200/60 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <svg viewBox="0 0 16 16" className="h-4 w-4 text-teal-600" fill="none" aria-hidden="true">
          <circle cx="6" cy="5" r="2.2" stroke="currentColor" strokeWidth="1.3" />
          <path d="M2 13c0-2.3 1.8-3.8 4-3.8S10 10.7 10 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="11.5" cy="5.5" r="1.8" stroke="currentColor" strokeWidth="1.3" />
          <path d="M10.8 9.4c1.8 0 3.2 1.4 3.2 3.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        <h2 className="font-brand-heading text-h3 text-navy-900">How everyone answered</h2>
        <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy-600">
          Staff view
        </span>
      </div>

      <p className="mt-1 text-[12px] text-navy-500">
        {data.hasReference ? (
          <>
            Reference: <span className="font-semibold text-navy-700">{data.staffAnswer}</span> ·{" "}
            {data.total} {data.total === 1 ? "spotter" : "spotters"}
          </>
        ) : (
          <>No reference yet (community clip) · {data.total} {data.total === 1 ? "spotter" : "spotters"}</>
        )}
      </p>

      {data.answers.length === 0 ? (
        <p className="mt-3 text-sm text-navy-500">No answers yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-navy-200/50">
          {data.answers.map((row) => (
            <Row key={row.id} row={row} />
          ))}
        </ul>
      )}
    </section>
  );
}
