"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import speciesTraitsData from "@/data/species-traits.json";
import type { SpeciesCatalogue } from "@/lib/idguide/traits";
import { IdGuideSheet } from "./IdGuideSheet";

// Q4-A-9: monoline SVG icons replacing emoji-as-icons (🐟, 🔍). Emoji
// glyphs render with the platform's emoji font (Apple Color Emoji,
// Segoe UI Emoji, etc.) and pull the visual register down to
// "hackathon weekend". Stroked SVGs in `text-current` inherit the
// parent's `text-*` colour so they tone-match the surrounding text.
function FishIcon({ className }: { className?: string }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M2 8c1.2-2.2 3.2-3.5 5.5-3.5C10.5 4.5 13 6 14 8c-1 2-3.5 3.5-6.5 3.5C5.2 11.5 3.2 10.2 2 8z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M14 8l1.5-1.5v3L14 8z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="5" cy="7.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

function MagnifierIcon({ className }: { className?: string }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle
        cx="7"
        cy="7"
        r="4.2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M10.5 10.5l3 3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

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
  /**
   * Reference identification for the snippet. Null when the snippet
   * has no reference yet (S7-T1) — in that case the "How to spot a X
   * next time" hint is suppressed because there's no species to teach.
   */
  staffAnswer: string | null;
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
    () =>
      submitted && staffAnswer
        ? resolveScientificName(staffAnswer)
        : undefined,
    [submitted, staffAnswer],
  );
  // Stabilise the object identity so IdGuideSheet's [open, fieldNoteFor]
  // effect doesn't reset selectedFallback every time FeedCard re-renders.
  const fieldNoteFor = useMemo(
    () =>
      staffAnswer ? { commonName: staffAnswer, scientificName } : null,
    [staffAnswer, scientificName],
  );

  if (submitted && staffAnswer) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/55 hover:text-white/85"
        >
          <FishIcon />
          How to spot a {staffAnswer} next time
        </button>
        <IdGuideSheet
          open={open}
          onClose={() => setOpen(false)}
          snippetId={snippetId}
          onAnswerPicked={() => setOpen(false)}
          fieldNoteFor={fieldNoteFor ?? undefined}
          isLoggedIn={isLoggedIn}
        />
      </>
    );
  }

  // S7-T1: submitted but no reference yet — no field-note shortcut. The
  // user can still open the guide via "Help me identify" if not yet
  // submitted; once submitted on a no-reference snippet we render nothing.
  if (submitted) {
    return null;
  }

  if (!isLoggedIn) {
    return (
      <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-white/45 hover:text-white/80"
        >
          <MagnifierIcon />
          Filter by traits
        </button>
        <Link
          href={`/auth/signin?callbackUrl=${encodeURIComponent("/feed")}`}
          className="text-teal-500 hover:text-teal-400"
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
        // Q4-A-8 (touch target) + Q4-A-9 (icon swap): Help me identify
        // is the primary IdGuide entry on a card. The mobile journey
        // measured it at 111×15px — effectively untappable for a
        // one-thumb user. Now a proper button with 44px min height and
        // a teal outline so it reads as an action, not a footnote.
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-teal-500/40 bg-teal-500/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-50 hover:border-teal-400 hover:bg-teal-500/20"
      >
        <MagnifierIcon />
        Help me identify
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
