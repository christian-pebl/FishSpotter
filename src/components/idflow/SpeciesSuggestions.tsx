"use client";

/**
 * Live "Did you mean…" suggestions under the Skip-to-guess text field.
 *
 * Reads the catalogue search index (answer-index.ts) on every keystroke — no
 * network — and lists the best real species matches, each submitting its
 * canonical common name (so the scoring matcher exact-matches). Variations are
 * handled by the index: aliases, plurals, genus, diacritics, small typos.
 *
 * Off-catalogue sightings are never blocked: when nothing matches (or there's
 * no exact hit), a "submit as typed" row commits the raw text as the +1 pending
 * community hypothesis the scoring model expects.
 *
 * Rendered inline (not absolutely positioned) so it scrolls with the panel
 * rather than being clipped by its overflow. Roving arrow-key focus + Escape
 * for keyboard operability; each row is a real button so Enter/Tab work too.
 */

import { useMemo, useRef } from "react";
import { searchSpecies } from "@/lib/idflow/answer-index";

export function SpeciesSuggestions({
  query,
  submitting,
  onSelect,
}: {
  query: string;
  submitting: boolean;
  /** Commit a guess (canonical common name, or raw text for off-catalogue). */
  onSelect: (name: string) => void;
}) {
  const trimmed = query.trim();
  const suggestions = useMemo(() => searchSpecies(query, 8), [query]);
  const hasExact = suggestions.some((s) => s.score >= 100);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  if (!trimmed) return null;

  // Roving focus across the rendered rows (suggestions + the "as typed" row).
  function focusItem(i: number) {
    const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
    if (items.length === 0) return;
    const idx = (i + items.length) % items.length;
    items[idx]?.focus();
  }
  function onKeyDown(e: React.KeyboardEvent, i: number) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(i + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(i - 1);
    } else if (e.key === "Escape") {
      (e.target as HTMLButtonElement).blur();
    }
  }

  itemRefs.current = [];
  let row = 0;

  return (
    <div
      className="mb-1.5 overflow-hidden rounded-modal border border-white/12 bg-white/[0.04]"
      role="listbox"
      aria-label="Species suggestions"
    >
      <div className="max-h-[40vh] overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15">
        {suggestions.map((s) => {
          const i = row++;
          return (
            <button
              key={s.scientificName}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="option"
              aria-selected={false}
              disabled={submitting}
              onClick={() => onSelect(s.commonName)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className="flex w-full items-baseline gap-2 border-b border-white/5 px-3 py-2 text-left transition-colors last:border-0 hover:bg-teal-500/15 focus:bg-teal-500/20 focus:outline-none disabled:opacity-60"
            >
              <span className="font-semibold text-white">{s.commonName}</span>
              <span className="truncate text-[11px] italic text-white/45">
                {s.scientificName}
              </span>
              {s.viaAlias && (
                <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wider text-teal-300/75">
                  “{s.matchedForm}”
                </span>
              )}
            </button>
          );
        })}

        {suggestions.length === 0 && (
          <p className="px-3 py-2 text-[11px] text-white/55">
            No catalogue match — you can still submit it as a new sighting.
          </p>
        )}

        {/* Off-catalogue escape hatch: always available when there's no exact
            hit, so a real sighting that isn't in the 57 can still be logged. */}
        {!hasExact &&
          (() => {
            const i = row++;
            return (
              <button
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                disabled={submitting}
                onClick={() => onSelect(trimmed)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className="flex w-full items-center gap-1.5 border-t border-white/10 px-3 py-2 text-left text-[11px] text-white/60 transition-colors hover:bg-white/10 focus:bg-white/10 focus:outline-none disabled:opacity-60"
              >
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="shrink-0 text-teal-400/80">
                  <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                Submit “<span className="font-medium text-white/85">{trimmed}</span>” as typed
              </button>
            );
          })()}
      </div>
    </div>
  );
}
