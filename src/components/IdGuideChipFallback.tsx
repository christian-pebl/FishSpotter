"use client";

import { useMemo } from "react";
import speciesTraitsData from "@/data/species-traits.json";
import { TRAIT_CATEGORIES, type SpeciesCatalogue, type TraitSelection } from "@/lib/idguide/traits";
import { narrowCandidates } from "@/lib/idguide/narrow";

const CATALOGUE = speciesTraitsData as unknown as SpeciesCatalogue;

const CATEGORY_LABELS: Record<keyof typeof TRAIT_CATEGORIES, string> = {
  bodyShape: "Body shape",
  size: "Size",
  coloration: "Colour",
  markings: "Markings",
  finShape: "Fins",
  features: "Features",
  behavior: "Behaviour",
  habitat: "Habitat",
};

function prettyValue(v: string): string {
  return v.replace(/-/g, " ");
}

export function IdGuideChipFallback({
  selected,
  onSelectionChange,
  onPickCandidate,
  onBackToChat,
}: {
  selected: TraitSelection;
  onSelectionChange: (next: TraitSelection) => void;
  onPickCandidate: (commonName: string) => void;
  onBackToChat?: () => void;
}) {
  const toggle = (category: keyof TraitSelection, value: string) => {
    const current = (selected[category] as string[] | undefined) ?? [];
    const has = current.includes(value);
    const next = has ? current.filter((v) => v !== value) : [...current, value];
    onSelectionChange({ ...selected, [category]: next } as TraitSelection);
  };

  const candidates = useMemo(
    () =>
      narrowCandidates({
        catalogue: CATALOGUE,
        mustHave: selected,
        limit: 8,
      }),
    [selected],
  );

  const hasSelections = Object.values(selected).some((v) => Array.isArray(v) && v.length > 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {(Object.keys(TRAIT_CATEGORIES) as Array<keyof typeof TRAIT_CATEGORIES>).map((cat) => (
          <div key={cat} className="pb-3">
            <p className="pb-1 text-[10px] uppercase tracking-wider text-white/55">
              {CATEGORY_LABELS[cat]}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TRAIT_CATEGORIES[cat].map((value) => {
                const isOn = ((selected[cat] as string[] | undefined) ?? []).includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggle(cat, value)}
                    aria-pressed={isOn}
                    className={
                      isOn
                        ? "rounded-full bg-teal-500 px-2.5 py-1 text-[11px] font-semibold text-navy-900"
                        : "rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-white/80 hover:border-white/40"
                    }
                  >
                    {prettyValue(value)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between pt-2 text-[10px] uppercase tracking-wider">
          {hasSelections ? (
            <button
              type="button"
              onClick={() => onSelectionChange({})}
              className="text-white/45 hover:text-white/80"
            >
              Clear filters
            </button>
          ) : (
            <span />
          )}
          {onBackToChat && (
            <button
              type="button"
              onClick={onBackToChat}
              className="text-teal-500 hover:text-teal-400"
            >
              Back to guided
            </button>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-white/10 bg-navy-800/95 px-4 py-3">
        <p className="pb-1.5 text-[10px] uppercase tracking-wider text-white/55">Matches</p>
        {candidates.length === 0 ? (
          <p className="text-xs text-white/45">
            {hasSelections
              ? "No species in the catalogue match those traits."
              : "Pick a few traits above to see matching species."}
          </p>
        ) : (
          <div className="max-h-40 space-y-1.5 overflow-y-auto">
            {candidates.slice(0, 6).map((c) => (
              <button
                key={c.scientificName}
                type="button"
                onClick={() => onPickCandidate(c.commonName)}
                className="block w-full rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-left text-[12px] hover:border-teal-500/60 hover:bg-white/10"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-white/90">{c.commonName}</span>
                  {c.totalTraitsConsidered > 0 && (
                    <span className="text-[10px] text-white/55">
                      matches {c.matchedTraits}/{c.totalTraitsConsidered}
                    </span>
                  )}
                </div>
                <div className="text-[10px] italic text-white/50">{c.scientificName}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
