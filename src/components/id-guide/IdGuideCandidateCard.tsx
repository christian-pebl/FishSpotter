"use client";

import { motion } from "framer-motion";
import type { Candidate, LocalStatus } from "./useIdGuide";

const LOCAL_STATUS_LABELS: Record<LocalStatus, { label: string; bg: string; text: string } | null> = {
  common: { label: "Common at this site", bg: "bg-[#3AAFA9]/15", text: "text-[#3AAFA9]" },
  occasional: { label: "Occasional locally", bg: "bg-[#DEF2F1]/12", text: "text-[#DEF2F1]" },
  uncommon: { label: "Rare for this site", bg: "bg-orange-400/12", text: "text-orange-300" },
  no_data: null, // hide when we have no checklist data
};

function emojiForName(n: string | undefined): string {
  if (!n) return "🐟";
  const lc = n.toLowerCase();
  if (lc.includes("crab")) return "🦀";
  if (lc.includes("jelly") || lc.includes("ctenophora")) return "🪼";
  if (lc.includes("squid") || lc.includes("octopus")) return "🦑";
  if (lc.includes("starfish") || lc.includes("brittle")) return "⭐";
  if (lc.includes("whelk") || lc.includes("snail") || lc.includes("gastropod")) return "🐚";
  if (lc.includes("shark") || lc.includes("nursehound") || lc.includes("catshark")) return "🦈";
  return "🐟";
}

interface Props {
  candidate: Candidate;
  highlight?: boolean; // top result
  onConfirm: () => void;
}

export function IdGuideCandidateCard({ candidate, highlight, onConfirm }: Props) {
  const { taxon, matchReasons, finalScore } = candidate;
  const confidencePct = Math.round(finalScore * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex flex-col gap-3 rounded-2xl border p-4 ${
        highlight
          ? "border-[#3AAFA9]/60 bg-[#3AAFA9]/10"
          : "border-white/12 bg-white/[0.04]"
      }`}
    >
      <div className="flex items-start gap-3">
        {taxon.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={taxon.heroImageUrl}
            alt={taxon.name}
            className="h-16 w-16 flex-shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-white/8 text-3xl">
            {emojiForName(taxon.name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-brand-heading text-lg leading-tight text-white">{taxon.name}</h3>
          {taxon.scientificName && (
            <p className="truncate text-xs italic text-white/65">{taxon.scientificName}</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/55">
              {confidencePct}% match
            </p>
            {candidate.localStatus && LOCAL_STATUS_LABELS[candidate.localStatus] && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${LOCAL_STATUS_LABELS[candidate.localStatus]!.bg} ${LOCAL_STATUS_LABELS[candidate.localStatus]!.text}`}
                title={
                  candidate.localRecords != null
                    ? `${candidate.localRecords.toLocaleString()} OBIS records nearby`
                    : undefined
                }
              >
                {LOCAL_STATUS_LABELS[candidate.localStatus]!.label}
              </span>
            )}
          </div>
        </div>
      </div>

      {taxon.funFact && (
        <p className="text-sm text-[#DEF2F1]">
          <span className="mr-1" aria-hidden>💡</span>
          {taxon.funFact}
        </p>
      )}

      {matchReasons.length > 0 && (
        <p className="text-[11px] text-white/55">
          Matched: <span className="text-white/75">{matchReasons.join(" · ")}</span>
        </p>
      )}

      <motion.button
        type="button"
        onClick={onConfirm}
        whileTap={{ scale: 0.97 }}
        className="mt-1 w-full rounded-full bg-[#3AAFA9] px-4 py-2.5 text-sm font-semibold text-[#17252A] hover:bg-[#59c8c3]"
      >
        ✓ Yes, that&apos;s it
      </motion.button>
    </motion.div>
  );
}
