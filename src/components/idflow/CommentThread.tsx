"use client";

/**
 * The public per-clip comment thread, rendered inside the post-submit reveal.
 *
 * Collapsed to a single summary line by default. That is not cosmetic: the
 * reveal's advance row is sticky, and an expanded thread would push "Next" out of
 * reach on a phone. The spotter opts in to reading.
 *
 * The server gates the content (GET /api/comments returns { gated: true } until
 * the caller has answered this clip — see the route's INV-1 note), so this
 * component simply renders whatever it is allowed to see.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { REPORT_REASONS, REASON_LABELS, type ReportReason } from "@/lib/comments";
import { CommentBox } from "./CommentBox";

type PublicComment = {
  id: string;
  parentId: string | null;
  reason: string;
  body: string;
  suggestedName: string | null;
  authorId: string;
  authorName: string;
  isPebl: boolean;
  isMine: boolean;
  isHidden: boolean;
  reportCount: number | null;
  createdAt: string;
  replies: PublicComment[];
};

type Payload = { gated: true } | { gated: false; total: number; comments: PublicComment[] };

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function ReportControl({ commentId }: { commentId: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  if (sent) {
    return <span className="text-[10px] text-white/55">Reported</span>;
  }

  async function report(reason: ReportReason) {
    setOpen(false);
    setSent(true);
    try {
      await fetch(`/api/comments/${commentId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
    } catch {
      // Optimistic: a failed report shouldn't nag. Staff also see the thread.
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex min-h-[44px] items-center pr-1 text-[10px] uppercase tracking-wider text-white/55 hover:text-white/85"
      >
        Report
      </button>
      {open && (
        <span className="absolute right-0 top-full z-20 mt-1 flex w-44 flex-col rounded-modal border border-white/15 bg-navy-900 p-1 shadow-menu">
          {REPORT_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => report(r)}
              className="inline-flex min-h-[36px] items-center rounded-modal px-2 text-left text-[11px] capitalize text-white/75 hover:bg-white/10"
            >
              {r.replace("-", " ")}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

function CommentRow({
  c,
  snippetId,
  isGuest,
  signedIn,
  onChanged,
  depth = 0,
}: {
  c: PublicComment;
  snippetId: string;
  isGuest: boolean;
  signedIn: boolean;
  onChanged: () => void;
  depth?: number;
}) {
  const [replying, setReplying] = useState(false);

  return (
    <li className={depth > 0 ? "ml-4 border-l border-white/10 pl-3" : ""}>
      <div className="py-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={`/u/${c.authorId}`}
            className={`text-xs font-semibold ${c.isMine ? "text-teal-200" : "text-white/85"}`}
          >
            {c.authorName}
          </Link>
          {c.isPebl && (
            <span className="inline-flex items-center rounded-full bg-teal-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-eyebrow text-teal-200">
              PEBL
            </span>
          )}
          {c.reason !== "note" && (
            <span className="inline-flex items-center rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] text-white/55">
              {REASON_LABELS[c.reason as keyof typeof REASON_LABELS] ?? c.reason}
            </span>
          )}
          <span className="text-[10px] text-white/50">{relativeTime(c.createdAt)}</span>
          {c.isHidden && (
            <span className="inline-flex items-center rounded-full bg-pending/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-eyebrow text-pending">
              {c.isMine ? "Held for review" : `Hidden${c.reportCount ? ` · ${c.reportCount}` : ""}`}
            </span>
          )}
        </div>

        {c.suggestedName && (
          <p className="mt-0.5 text-[11px] italic text-teal-200/80">
            Suggested: {c.suggestedName}
          </p>
        )}

        <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-white/85">
          {c.body}
        </p>

        <div className="mt-0.5 flex items-center gap-3">
          {signedIn && !isGuest && depth === 0 && (
            <button
              type="button"
              onClick={() => setReplying((v) => !v)}
              className="inline-flex min-h-[44px] items-center pr-1 text-[10px] uppercase tracking-wider text-white/60 hover:text-white/90"
            >
              Reply
            </button>
          )}
          {signedIn && !c.isMine && <ReportControl commentId={c.id} />}
        </div>

        {replying && (
          <div className="mt-2">
            <CommentBox
              snippetId={snippetId}
              parentId={c.id}
              isGuest={isGuest}
              autoFocus
              onCancel={() => setReplying(false)}
              onPosted={() => {
                setReplying(false);
                onChanged();
              }}
            />
          </div>
        )}
      </div>

      {c.replies.length > 0 && (
        <ul>
          {c.replies.map((r) => (
            <CommentRow
              key={r.id}
              c={r}
              snippetId={snippetId}
              isGuest={isGuest}
              signedIn={signedIn}
              onChanged={onChanged}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function CommentThread({
  snippetId,
  signedIn,
  isGuest,
  signUpHref,
  defaultOpen = false,
}: {
  snippetId: string;
  signedIn: boolean;
  isGuest: boolean;
  signUpHref?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/comments?snippetId=${encodeURIComponent(snippetId)}`);
      setData((await res.json()) as Payload);
    } catch {
      setData({ gated: false, total: 0, comments: [] });
    } finally {
      setLoading(false);
    }
  }, [snippetId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Gated: the viewer hasn't made their own call yet. Say so plainly — it reads
  // as an incentive to commit rather than as a wall.
  if (data && data.gated) {
    return (
      <p className="mt-3 text-[11px] text-white/45">
        Make your call to unlock the discussion on this clip.
      </p>
    );
  }

  const total = data && !data.gated ? data.total : 0;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex min-h-[44px] w-full items-center gap-2 text-left text-[10px] uppercase tracking-wider text-white/70 hover:text-white/90"
      >
        <svg viewBox="0 0 14 14" className="h-3 w-3 shrink-0 text-teal-500/80" fill="none" aria-hidden="true">
          <path
            d="M2 3.2h10v6.1H6.4L3.6 11.4V9.3H2z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
        {total === 0 ? "Start the discussion" : `${total} comment${total === 1 ? "" : "s"}`}
        <svg
          viewBox="0 0 12 12"
          className={`ml-auto h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          aria-hidden="true"
        >
          <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="mt-1.5">
          {loading && !data && <p className="text-[11px] text-white/40">Loading…</p>}

          {data && !data.gated && data.comments.length > 0 && (
            <ul className="mb-2 divide-y divide-white/5">
              {data.comments.map((c) => (
                <CommentRow
                  key={c.id}
                  c={c}
                  snippetId={snippetId}
                  isGuest={isGuest}
                  signedIn={signedIn}
                  onChanged={load}
                />
              ))}
            </ul>
          )}

          {signedIn ? (
            <CommentBox
              snippetId={snippetId}
              isGuest={isGuest}
              signUpHref={signUpHref}
              onPosted={load}
            />
          ) : (
            <p className="text-[11px] text-white/45">Sign in to join the discussion.</p>
          )}
        </div>
      )}
    </div>
  );
}
