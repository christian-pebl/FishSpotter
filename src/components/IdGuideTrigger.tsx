"use client";

import Link from "next/link";
import { useState } from "react";
import { IdGuideSheet } from "./IdGuideSheet";

export function IdGuideTrigger({
  snippetId,
  submitted,
  staffAnswer,
  onSuggest,
  isLoggedIn,
}: {
  snippetId: string;
  submitted: boolean;
  staffAnswer: string;
  /** Called when the user picks a candidate from the guide. Should write the value into the quiz input. */
  onSuggest: (commonName: string) => void;
  /** When false, the chat path is replaced with a sign-in nudge — the manual
   *  trait filter is still available because it doesn't hit the chat API. */
  isLoggedIn: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (submitted) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[10px] uppercase tracking-wider text-white/55 hover:text-white/85"
        >
          🐟 How to spot a {staffAnswer} next time
        </button>
        <IdGuideSheet
          open={open}
          onClose={() => setOpen(false)}
          snippetId={snippetId}
          onAnswerPicked={() => setOpen(false)}
          fieldNoteFor={{ commonName: staffAnswer }}
          isLoggedIn={isLoggedIn}
        />
      </>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-white/45 hover:text-white/80"
        >
          🔍 Filter by traits
        </button>
        <Link
          href={`/auth/signin?callbackUrl=${encodeURIComponent("/feed")}`}
          className="text-[#3AAFA9] hover:text-[#59c8c3]"
        >
          Sign in to ask the biologist
        </Link>
        <IdGuideSheet
          open={open}
          onClose={() => setOpen(false)}
          snippetId={snippetId}
          onAnswerPicked={onSuggest}
          isLoggedIn={false}
        />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] uppercase tracking-wider text-white/45 hover:text-white/80"
      >
        🔍 Help me identify
      </button>
      <IdGuideSheet
        open={open}
        onClose={() => setOpen(false)}
        snippetId={snippetId}
        onAnswerPicked={onSuggest}
        isLoggedIn={true}
      />
    </>
  );
}
