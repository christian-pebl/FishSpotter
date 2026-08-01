"use client";

/**
 * Staff triage + moderation queue for clip comments.
 *
 * Filter pills across the top, then one row per comment with the clip, the
 * spotter's own call for context, and the action set. The canned replies are
 * one tap on purpose: a reply affordance that takes three decisions doesn't get
 * used on a busy day, and an unanswered feedback box is worse than none.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { OUTCOME_CODES, REASON_LABELS } from "@/lib/comments";
import {
  acknowledgeComment,
  deleteComment,
  dismissComment,
  hideComment,
  replyToComment,
  resolveComment,
  unhideComment,
} from "./actions";

export type InboxRow = {
  id: string;
  body: string;
  reason: string;
  suggestedName: string | null;
  status: string;
  outcome: string | null;
  isHidden: boolean;
  hiddenReason: string | null;
  reportCount: number;
  adminNote: string | null;
  handledBy: string | null;
  createdAt: string;
  isReply: boolean;
  authorId: string;
  authorName: string;
  authorIsGuest: boolean;
  snippetId: string;
  snippetLabel: string;
  snippetSite: string;
  thumbnailUrl: string;
  theirAnswer: string | null;
};

const CANNED = [
  "Thanks, logged.",
  "Good catch, we've fixed the clip.",
  "Adding this species.",
  "We'll take another look.",
];

const STATUS_CHIP: Record<string, string> = {
  // Teal rather than the `pending` amber token. `pending` is the right semantic
  // on the dark feed reveal, but on this light admin surface amber-300 reads as
  // a warning about the comment rather than a triage state.
  new: "bg-teal-600 text-white",
  acknowledged: "bg-navy-100 text-navy-700",
  resolved: "bg-correct text-correct-ink",
  dismissed: "bg-navy-100 text-navy-500",
};

function Pill({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium transition ${
        active ? "bg-teal-600 text-white" : "bg-navy-100 text-navy-700 hover:bg-navy-200"
      }`}
    >
      {children}
    </Link>
  );
}

function Row({ row }: { row: InboxRow }) {
  const [pending, start] = useTransition();
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState<string>("catalogue-added");
  const [open, setOpen] = useState(false);

  const act = (fn: () => Promise<unknown>) => start(() => void fn());

  return (
    <li className={`p-3 ${pending ? "opacity-50" : ""}`}>
      <div className="flex gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote storage URL */}
        <img
          src={row.thumbnailUrl}
          alt=""
          loading="lazy"
          className="h-14 w-14 shrink-0 rounded-modal object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow ${
                STATUS_CHIP[row.status] ?? "bg-navy-100 text-navy-700"
              }`}
            >
              {row.status}
            </span>
            {row.reason !== "note" && (
              <span className="inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-medium text-teal-800">
                {REASON_LABELS[row.reason as keyof typeof REASON_LABELS] ?? row.reason}
              </span>
            )}
            {row.isReply && (
              <span className="text-[10px] text-navy-400">reply</span>
            )}
            {row.reportCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-incorrect px-2 py-0.5 text-[10px] font-semibold text-incorrect-ink">
                {row.reportCount} report{row.reportCount === 1 ? "" : "s"}
              </span>
            )}
            {row.isHidden && (
              <span className="inline-flex items-center rounded-full bg-navy-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                hidden
              </span>
            )}
            {row.authorIsGuest && (
              <span className="text-[10px] text-navy-400">guest</span>
            )}
          </div>

          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-navy-900">{row.body}</p>

          {row.suggestedName && (
            <p className="mt-0.5 text-[12px] italic text-teal-700">
              Suggested: {row.suggestedName}
            </p>
          )}

          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-navy-500">
            <Link href={`/u/${row.authorId}`} className="font-medium text-navy-700 hover:underline">
              {row.authorName}
            </Link>
            <span>·</span>
            {row.theirAnswer ? <span>called it “{row.theirAnswer}”</span> : <span>no call</span>}
            <span>·</span>
            {/* Clip ids run to ~55 chars and wrapped across three lines, which
                buried the rest of the metadata. The tail is the distinguishing
                part, but the head is what staff recognise, so truncate + title. */}
            <Link
              href={`/admin/snippets/${row.snippetId}`}
              title={row.snippetLabel}
              className="inline-block max-w-[14rem] truncate align-bottom hover:underline"
            >
              {row.snippetLabel}
            </Link>
            <span>·</span>
            <span>{new Date(row.createdAt).toLocaleString("en-GB")}</span>
          </p>

          {row.hiddenReason && (
            <p className="mt-1 text-[11px] text-navy-500">Hidden: {row.hiddenReason}</p>
          )}
          {row.adminNote && (
            <p className="mt-1 text-[11px] text-navy-500">Note: {row.adminNote}</p>
          )}
          {row.outcome && (
            <p className="mt-1 text-[11px] text-navy-500">
              Outcome: {row.outcome}
              {row.handledBy ? ` · ${row.handledBy}` : ""}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => act(() => acknowledgeComment(row.id))}
              className="inline-flex min-h-[44px] items-center rounded-full bg-navy-100 px-3 text-[12px] font-medium text-navy-700 hover:bg-navy-200"
            >
              Acknowledge
            </button>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex min-h-[44px] items-center rounded-full bg-teal-600 px-3 text-[12px] font-medium text-white hover:bg-teal-700"
            >
              Reply / resolve
            </button>
            <button
              type="button"
              onClick={() =>
                act(() => (row.isHidden ? unhideComment(row.id) : hideComment(row.id)))
              }
              className="inline-flex min-h-[44px] items-center rounded-full bg-navy-100 px-3 text-[12px] font-medium text-navy-700 hover:bg-navy-200"
            >
              {row.isHidden ? "Unhide" : "Hide"}
            </button>
            <button
              type="button"
              onClick={() => act(() => dismissComment(row.id))}
              className="inline-flex min-h-[44px] items-center rounded-full px-3 text-[12px] font-medium text-navy-500 hover:bg-navy-100"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm("Delete permanently? Use Hide unless this is illegal content.")) {
                  act(() => deleteComment(row.id));
                }
              }}
              className="inline-flex min-h-[44px] items-center rounded-full px-3 text-[12px] font-medium text-incorrect-ink hover:bg-incorrect/20"
            >
              Delete
            </button>
          </div>

          {open && (
            <div className="mt-2 rounded-modal border border-navy-200 bg-navy-50 p-2">
              <div className="flex flex-wrap gap-1.5">
                {CANNED.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => act(() => replyToComment(row.id, c))}
                    className="inline-flex min-h-[44px] items-center rounded-full bg-white px-3 text-[12px] text-navy-700 ring-1 ring-navy-200 hover:bg-teal-50"
                  >
                    {c}
                  </button>
                ))}
              </div>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={2}
                placeholder="Or write a reply (posted publicly in the thread as you)…"
                className="mt-2 w-full rounded-modal border border-navy-200 px-2 py-1.5 text-[13px] text-navy-900"
              />
              <button
                type="button"
                disabled={!reply.trim()}
                onClick={() => {
                  act(() => replyToComment(row.id, reply));
                  setReply("");
                }}
                className="mt-1 inline-flex min-h-[44px] items-center rounded-full bg-teal-600 px-3 text-[12px] font-medium text-white hover:bg-teal-700 disabled:opacity-40"
              >
                Post reply
              </button>

              <div className="mt-3 border-t border-navy-200 pt-2">
                <label className="block text-[11px] font-medium text-navy-600">
                  Resolve with outcome
                </label>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <select
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    className="min-h-[44px] rounded-modal border border-navy-200 px-2 text-[12px] text-navy-900"
                  >
                    {OUTCOME_CODES.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Internal note (never shown to spotters)"
                    className="min-h-[44px] min-w-[220px] flex-1 rounded-modal border border-navy-200 px-2 text-[12px] text-navy-900"
                  />
                  <button
                    type="button"
                    onClick={() => act(() => resolveComment(row.id, outcome, note))}
                    className="inline-flex min-h-[44px] items-center rounded-full bg-correct px-3 text-[12px] font-medium text-correct-ink"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export function CommentInbox({
  rows,
  activeStatus,
  activeReason,
  activeView,
  reasons,
}: {
  rows: InboxRow[];
  activeStatus: string;
  activeReason: string;
  activeView: string;
  reasons: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  const href = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params?.toString() ?? "");
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    return `/admin/comments?${next.toString()}`;
  };

  return (
    <div className="space-y-3">
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
        {["new", "acknowledged", "resolved", "dismissed", "all"].map((s) => (
          <Pill key={s} active={activeStatus === s && !activeView} href={href({ status: s, view: "" })}>
            {s[0].toUpperCase() + s.slice(1)}
          </Pill>
        ))}
        <Pill active={activeView === "reported"} href={href({ view: "reported", status: "" })}>
          Reported
        </Pill>
        <Pill active={activeView === "held"} href={href({ view: "held", status: "" })}>
          Held
        </Pill>
      </nav>

      {/* Scrolls rather than wraps: wrapping seven reason tags builds a dense
          multi-line block that eats the screen above the actual queue on a phone. */}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
        <button
          type="button"
          onClick={() => router.push(href({ reason: "" }))}
          className={`inline-flex min-h-[44px] shrink-0 items-center rounded-full px-3 text-[12px] ${
            !activeReason ? "bg-navy-900 text-white" : "bg-navy-100 text-navy-700"
          }`}
        >
          All reasons
        </button>
        {reasons.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => router.push(href({ reason: r }))}
            className={`inline-flex min-h-[44px] shrink-0 items-center rounded-full px-3 text-[12px] ${
              activeReason === r ? "bg-navy-900 text-white" : "bg-navy-100 text-navy-700"
            }`}
          >
            {REASON_LABELS[r as keyof typeof REASON_LABELS] ?? r}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-card border border-navy-200 bg-white p-6 text-center text-sm text-navy-500">
          Nothing here. That&apos;s either a quiet week or a well-drained inbox.
        </p>
      ) : (
        <ul className="divide-y divide-navy-200/60 rounded-card border border-navy-200/60 bg-white">
          {rows.map((r) => (
            <Row key={r.id} row={r} />
          ))}
        </ul>
      )}
    </div>
  );
}
