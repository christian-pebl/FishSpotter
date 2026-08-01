"use client";

import { useState, useTransition } from "react";
import { setPrizeFulfilled } from "./actions";

/**
 * Copy a winner's address to the clipboard. The desk's whole job is getting an
 * email out, and hand-retyping an address is the one step that can silently
 * send a book to the wrong person.
 */
export function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(email);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          // Clipboard blocked (insecure context / denied permission): the
          // address is rendered next to this button, so copying by hand still
          // works. Nothing to recover from.
        }
      }}
      aria-label={`Copy ${email} to the clipboard`}
      className="inline-flex h-11 items-center whitespace-nowrap rounded-full px-3 text-[11px] font-medium text-teal-600 transition hover:bg-teal-50 hover:text-teal-700"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/**
 * The one write on this page: mark a claimed guide posted, or undo a mis-click.
 * Optimistic — the row flips immediately and reverts if the action throws, so a
 * slow round-trip can't tempt an admin into double-marking.
 */
export function PostedToggle({
  userId,
  spotter,
  fulfilled,
}: {
  userId: string;
  spotter: string;
  fulfilled: boolean;
}) {
  const [posted, setPosted] = useState(fulfilled);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !posted;
    setPosted(next);
    setError("");
    startTransition(async () => {
      try {
        await setPrizeFulfilled(userId, next);
      } catch {
        setPosted(!next);
        setError("Could not save — try again.");
      }
    });
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={posted}
        aria-label={
          posted
            ? `Mark ${spotter}'s guide as not posted`
            : `Mark ${spotter}'s guide as posted`
        }
        className={`inline-flex h-11 items-center whitespace-nowrap rounded-full px-4 text-[11px] font-semibold transition disabled:opacity-60 ${
          posted
            ? "bg-navy-100 text-navy-700 hover:bg-navy-200"
            : "bg-teal-600 text-white hover:bg-teal-700"
        }`}
      >
        {posted ? "Undo posted" : "Mark posted"}
      </button>
      {error ? <span className="text-[10px] text-incorrect-ink">{error}</span> : null}
    </div>
  );
}
