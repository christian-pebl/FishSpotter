"use client";

/**
 * Comment composer for the clip thread.
 *
 * Sits inside the post-submit reveal (and, pre-tagged as "not-listed", behind the
 * candidate gate's "I can't find it" action). Optional reason chips, a body
 * field with a live character budget, and a Send button.
 *
 * Guests get a disabled state with a signup link rather than a hidden control:
 * they can read the thread but not post (a guest account is username-only and
 * unverified, so it is a free unlimited posting identity), and the block doubles
 * as the existing "save my finds" conversion moment.
 */

import { useState } from "react";
import Link from "next/link";
import {
  MAX_BODY,
  MAX_SUGGESTED_NAME,
  REASON_CODES,
  REASON_LABELS,
  type ReasonCode,
} from "@/lib/comments";

export function CommentBox({
  snippetId,
  parentId,
  initialReason,
  isGuest,
  signUpHref = "/auth/signin",
  onPosted,
  onCancel,
  autoFocus,
}: {
  snippetId: string;
  parentId?: string;
  /** Pre-selects a reason (the candidate gate's "I can't find it" passes "not-listed"). */
  initialReason?: ReasonCode;
  isGuest: boolean;
  signUpHref?: string;
  onPosted?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const [reason, setReason] = useState<ReasonCode>(initialReason ?? "note");
  const [body, setBody] = useState("");
  const [suggestedName, setSuggestedName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [held, setHeld] = useState(false);
  const [done, setDone] = useState(false);

  const wantsName = reason === "not-listed" || reason === "disagree";
  const remaining = MAX_BODY - body.length;
  const canSend = body.trim().length > 0 && !busy && remaining >= 0;

  async function submit() {
    if (!canSend) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snippetId,
          body,
          reason,
          ...(parentId ? { parentId } : {}),
          ...(wantsName && suggestedName.trim() ? { suggestedName } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        held?: boolean;
      };
      if (!res.ok) {
        setError(data.error ?? "Couldn't post that. Try again in a moment.");
        return;
      }
      setBody("");
      setSuggestedName("");
      setHeld(!!data.held);
      setDone(true);
      onPosted?.();
    } catch {
      setError("Couldn't reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  if (isGuest) {
    return (
      <div className="rounded-modal border border-teal-500/30 bg-teal-500/10 p-3">
        <p className="text-xs text-white/75">
          Create a free profile to join the discussion. Your spots are saved either way.
        </p>
        <Link
          href={signUpHref}
          className="mt-2 inline-flex min-h-[44px] items-center justify-center rounded-full bg-teal-500 px-4 text-xs font-semibold text-navy-900 transition-colors hover:bg-teal-400"
        >
          Sign up free
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-modal border border-white/10 bg-white/[0.06] p-3">
        <p className="flex items-start gap-2 text-xs text-white/80">
          <svg viewBox="0 0 14 14" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-400" fill="none" aria-hidden="true">
            <path d="M2.5 7.5l3 3L11.5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>
            {held
              ? "Thanks. This one's gone to PEBL for a quick check before it appears."
              : "Posted. Thanks for adding to this one."}
          </span>
        </p>
        <button
          type="button"
          onClick={() => {
            setDone(false);
            setHeld(false);
          }}
          className="mt-1 inline-flex min-h-[44px] items-center text-[10px] uppercase tracking-wider text-white/60 hover:text-white/85"
        >
          Add another
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-modal border border-white/10 bg-white/[0.06] p-3">
      {!parentId && (
        // One scrolling row, not a wrap: six chips wrapped to four rows pushed
        // the textarea and Post button off the bottom of a 390px screen.
        <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
          {REASON_CODES.map((code) => {
            const active = reason === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => setReason(code)}
                aria-pressed={active}
                className={`inline-flex min-h-[36px] shrink-0 items-center whitespace-nowrap rounded-full px-3 py-1 text-[11px] transition-colors ${
                  active
                    ? "bg-teal-500 font-semibold text-navy-900"
                    : "bg-white/15 text-white/85 hover:bg-white/25"
                }`}
              >
                {REASON_LABELS[code]}
              </button>
            );
          })}
        </div>
      )}

      {wantsName && !parentId && (
        <input
          type="text"
          value={suggestedName}
          onChange={(e) => setSuggestedName(e.target.value.slice(0, MAX_SUGGESTED_NAME))}
          placeholder="What do you think it is? (optional)"
          className="mt-2 w-full rounded-modal border border-white/15 bg-navy-900/50 px-3 py-2 text-sm text-white placeholder:text-white/60 focus:border-teal-500/60 focus:outline-none"
        />
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- opened by explicit user action
        autoFocus={autoFocus}
        rows={3}
        placeholder={
          parentId ? "Write a reply…" : "What did you notice? Anything worth flagging?"
        }
        className="mt-2 w-full resize-y rounded-modal border border-white/15 bg-navy-900/50 px-3 py-2 text-sm text-white placeholder:text-white/60 focus:border-teal-500/60 focus:outline-none"
      />

      {error && <p className="mt-1.5 text-[11px] text-incorrect">{error}</p>}

      <div className="mt-2 flex items-center justify-between gap-2">
        <span
          className={`text-[10px] tabular-nums ${
            remaining < 0 ? "text-incorrect" : "text-white/40"
          }`}
        >
          {remaining} left
        </span>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex min-h-[44px] items-center px-2 text-[10px] uppercase tracking-wider text-white/60 hover:text-white/85"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-teal-500 px-4 text-xs font-semibold text-navy-900 transition-colors hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Sending…" : parentId ? "Reply" : "Post"}
          </button>
        </div>
      </div>

      <p className="mt-1.5 text-[10px] leading-snug text-white/50">
        Comments are public to other spotters who&apos;ve made their call. No links.
      </p>
    </div>
  );
}
