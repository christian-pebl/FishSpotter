"use client";

import { useState, useTransition } from "react";
import { setSnippetReference, type SetReferenceResult } from "./actions";

export function SnippetReferenceEditor({
  snippetId,
  currentValue,
  currentRaw,
  catalogue,
}: {
  snippetId: string;
  /** current staffAnswer IF it is a catalogue species, else null */
  currentValue: string | null;
  /** the raw current staffAnswer (may be a coarse group like "Gastropod") */
  currentRaw: string | null;
  catalogue: { scientificName: string; commonName: string }[];
}) {
  const [value, setValue] = useState<string>(currentValue ?? ""); // "" = community / clear
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SetReferenceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const newStaff = value || null;
  const changed = newStaff !== currentRaw;

  const currentLabel = currentRaw
    ? currentValue
      ? `Verified: ${catalogue.find((c) => c.scientificName === currentRaw)?.commonName ?? currentRaw}`
      : `Group only: ${currentRaw}`
    : "Community (no reference)";

  const save = () => {
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await setSnippetReference(snippetId, newStaff));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  };

  return (
    <section className="rounded-lg border border-navy-200/60 bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-navy-500">Reference</p>
      <p className="mt-1 text-sm text-navy-700">{currentLabel}</p>

      <label className="mt-3 block text-[12px] font-medium text-navy-700">
        Set reference
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1 block w-full rounded-md border border-navy-300 bg-white px-2 py-2 text-sm text-navy-900"
        >
          <option value="">Community (no reference — crowd decides)</option>
          {catalogue.map((c) => (
            <option key={c.scientificName} value={c.scientificName}>
              {c.commonName} ({c.scientificName})
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={save}
        disabled={!changed || pending}
        className="mt-3 inline-flex items-center rounded-md bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save + re-judge"}
      </button>

      {result && (
        <p className="mt-2 text-[12px] text-teal-700">
          Re-judged {result.rescored} answers · {result.nowCorrect} correct · {result.unlocked} species
          unlocked.
        </p>
      )}
      {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
      <p className="mt-2 text-[11px] text-navy-500">
        Saving re-judges every existing answer&apos;s verdict on this clip and unlocks the species for
        spotters who got it right. Pebbles balances are never changed. Clearing makes it a community
        clip (crowd consensus decides).
      </p>
    </section>
  );
}
