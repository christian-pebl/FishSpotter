"use client";

import { AGE_BANDS, AGE_BAND_LABEL, type AgeBand } from "@/lib/age";

/**
 * The age question, as three equal buttons. Deliberately neutral (the FTC's
 * word for a COPPA age screen): no option is styled or worded as the right
 * one, and nothing on screen says an age is too young, because under-13s have
 * a real way to play. A screen that punishes one answer teaches children to
 * pick another.
 */
export function AgeBandPicker({
  onPick,
  disabled = false,
  labelledBy,
}: {
  onPick: (band: AgeBand) => void;
  disabled?: boolean;
  /** id of the visible question text. */
  labelledBy: string;
}) {
  return (
    <div role="group" aria-labelledby={labelledBy} className="mt-4 grid gap-2">
      {AGE_BANDS.map((band) => (
        <button
          key={band}
          type="button"
          disabled={disabled}
          onClick={() => onPick(band)}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-navy-900/15 bg-white px-5 py-2.5 text-sm font-semibold text-navy-900 transition-colors hover:border-teal-500 hover:bg-surface-muted disabled:opacity-60"
        >
          {AGE_BAND_LABEL[band]}
        </button>
      ))}
    </div>
  );
}
