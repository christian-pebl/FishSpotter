"use client";

import { useState } from "react";
import { IdGuideSheet } from "./IdGuideSheet";

export function IdGuideTrigger({
  snippetId,
  submitted,
  staffAnswer,
  onSuggest,
}: {
  snippetId: string;
  submitted: boolean;
  staffAnswer: string;
  /** Called when the user picks a candidate from the guide. Should write the value into the quiz input. */
  onSuggest: (commonName: string) => void;
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
        />
      </>
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
      />
    </>
  );
}
