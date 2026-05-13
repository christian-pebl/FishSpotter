"use client";

import type { Candidate } from "./useIdGuide";
import { IdGuideCandidateCard } from "./IdGuideCandidateCard";

interface Props {
  candidates: Candidate[];
  onConfirm: (taxonName: string) => void;
  onReject: () => void;
  onBail: () => void;
}

export function IdGuideResults({ candidates, onConfirm, onReject, onBail }: Props) {
  if (candidates.length === 0) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h2 className="font-brand-heading text-xl text-white">No close match</h2>
        <p className="text-sm text-white/75">
          We couldn&apos;t narrow this down to a confident match. Try adjusting your answers, or type your guess directly.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onReject}
            className="rounded-full border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:border-[#3AAFA9]"
          >
            ← Adjust answers
          </button>
          <button
            type="button"
            onClick={onBail}
            className="rounded-full bg-[#3AAFA9] px-4 py-2 text-sm font-semibold text-[#17252A] hover:bg-[#59c8c3]"
          >
            Type instead
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-brand-heading text-xl text-white">
          {candidates.length === 1
            ? "1 likely match"
            : `${candidates.length} likely matches`}
        </h2>
        <button
          type="button"
          onClick={onReject}
          className="text-xs text-white/65 underline underline-offset-4 hover:text-white"
        >
          Adjust answers
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {candidates.map((c, i) => (
          <IdGuideCandidateCard
            key={c.taxon.id}
            candidate={c}
            highlight={i === 0}
            onConfirm={() => onConfirm(c.taxon.name)}
          />
        ))}
      </div>

      <p className="mt-2 text-center text-[11px] text-white/55">
        Don&apos;t see it? <button type="button" onClick={onBail} className="text-[#DEF2F1] underline underline-offset-4">Type your own answer</button>
      </p>
    </div>
  );
}
