"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import speciesTraitsData from "@/data/species-traits.json";
import type { SpeciesCatalogue } from "@/lib/idguide/traits";
import { IdGuideSheet } from "./IdGuideSheet";

const CATALOGUE = speciesTraitsData as unknown as SpeciesCatalogue;

// staffAnswer comes from operator metadata and isn't always punctuated the
// same way as the catalogue commonName (e.g. "lesser spotted catshark" vs
// "Lesser-spotted catshark"). Compare in a punctuation-insensitive way so
// the field-note lookup actually resolves.
function normalise(name: string) {
  return name.toLowerCase().replace(/[-\s]+/g, "");
}

function resolveScientificName(commonName: string): string | undefined {
  const target = normalise(commonName);
  if (!target) return undefined;
  for (const [sci, traits] of Object.entries(CATALOGUE)) {
    if (normalise(traits.commonName) === target) return sci;
  }
  return undefined;
}

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

  // Resolve once per render so IdGuideSheet's lookup hits the scientific-name
  // path instead of relying on a brittle case-only commonName match.
  const scientificName = useMemo(
    () => (submitted ? resolveScientificName(staffAnswer) : undefined),
    [submitted, staffAnswer],
  );

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
          fieldNoteFor={{ commonName: staffAnswer, scientificName }}
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
