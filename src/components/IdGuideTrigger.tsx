"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import speciesTraitsData from "@/data/species-traits.json";
import type { SpeciesCatalogue } from "@/lib/idguide/traits";
import { IdGuideSheet } from "./IdGuideSheet";

const CATALOGUE = speciesTraitsData as unknown as SpeciesCatalogue;

// staffAnswer comes from operator metadata and isn't always punctuated the
// same way as the catalogue commonName ("lesser spotted catshark" vs
// "Lesser-spotted catshark", "Mackerel, Atlantic" vs "Atlantic mackerel",
// "Pollack (Pollachius pollachius)" vs "Pollack"). Try three increasingly
// permissive comparisons before giving up.
function normalise(name: string) {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, "") // strip parenthetical authorship/scientific names
    .replace(/[^a-z0-9]+/g, ""); // drop all non-alphanumerics
}

function tokenSort(name: string) {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .sort()
    .join("");
}

function stripPlural(s: string) {
  return s.endsWith("s") && s.length > 3 ? s.slice(0, -1) : s;
}

function resolveScientificName(commonName: string): string | undefined {
  const target = normalise(commonName);
  if (!target) return undefined;
  // Some operators record the scientific name directly.
  for (const sci of Object.keys(CATALOGUE)) {
    if (normalise(sci) === target) return sci;
  }
  // Normalised commonName match.
  for (const [sci, traits] of Object.entries(CATALOGUE)) {
    if (normalise(traits.commonName) === target) return sci;
  }
  // Plural-insensitive ("Sprats" → "Sprat").
  const singular = stripPlural(target);
  for (const [sci, traits] of Object.entries(CATALOGUE)) {
    if (stripPlural(normalise(traits.commonName)) === singular) return sci;
  }
  // Token-order-insensitive ("Mackerel, Atlantic" → "Atlantic mackerel").
  const targetTokens = tokenSort(commonName);
  for (const [sci, traits] of Object.entries(CATALOGUE)) {
    if (tokenSort(traits.commonName) === targetTokens) return sci;
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
  // Stabilise the object identity so IdGuideSheet's [open, fieldNoteFor]
  // effect doesn't reset selectedFallback every time FeedCard re-renders.
  const fieldNoteFor = useMemo(
    () => ({ commonName: staffAnswer, scientificName }),
    [staffAnswer, scientificName],
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
          fieldNoteFor={fieldNoteFor}
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
