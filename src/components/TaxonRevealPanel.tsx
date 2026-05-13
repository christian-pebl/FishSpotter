"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { MyAnswer, TaxonSummary } from "@/lib/useCreatureQuiz";

interface StatsItem {
  option: string;
  count: number;
  percent: number;
  taxonId: string | null;
}

interface Props {
  myAnswer: MyAnswer;
  stats: { total: number; stats: StatsItem[] } | null;
  hasNext: boolean;
  onAdvance: () => void;
  onEdit?: () => void;
}

function emojiForTaxon(t: TaxonSummary | null): string {
  if (!t) return "🐟";
  const n = t.name.toLowerCase();
  if (n.includes("crab")) return "🦀";
  if (n.includes("jelly") || n.includes("ctenophora")) return "🪼";
  if (n.includes("squid")) return "🦑";
  if (n.includes("starfish")) return "⭐";
  if (n.includes("whelk") || n.includes("snail") || n.includes("gastropod")) return "🐚";
  if (n.includes("shark") || n.includes("nursehound") || n.includes("catshark")) return "🦈";
  return "🐟";
}

function TaxonHero({ taxon, label, accent }: { taxon: TaxonSummary; label: string; accent: "green" | "orange" | "blue" }) {
  const accentClass =
    accent === "green"
      ? "border-[#3AAFA9] bg-[#3AAFA9]/15"
      : accent === "orange"
        ? "border-orange-400 bg-orange-400/10"
        : "border-[#DEF2F1] bg-[#DEF2F1]/10";

  return (
    <div className={`rounded-2xl border ${accentClass} p-4`}>
      <div className="flex items-center gap-3">
        {taxon.heroImageUrl ? (
          <img
            src={taxon.heroImageUrl}
            alt={taxon.name}
            className="h-16 w-16 rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/10 text-3xl">
            {emojiForTaxon(taxon)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">
            {label}
          </p>
          <h3 className="font-brand-heading truncate text-lg">{taxon.name}</h3>
          {taxon.scientificName && (
            <p className="truncate text-xs italic text-white/65">{taxon.scientificName}</p>
          )}
        </div>
      </div>
      {taxon.funFact && (
        <p className="mt-3 text-sm text-[#DEF2F1]">
          <span className="mr-1">💡</span>
          {taxon.funFact}
        </p>
      )}
    </div>
  );
}

export function TaxonRevealPanel({ myAnswer, stats, hasNext, onAdvance, onEdit }: Props) {
  const outcome = myAnswer.outcome;
  const taxon = outcome === "wrong" ? myAnswer.staffTaxon : myAnswer.resolvedTaxon ?? myAnswer.staffTaxon;

  const verdict =
    outcome === "correct"
      ? { emoji: "✅", text: "Spot on!", color: "text-[#3AAFA9]" }
      : outcome === "wrong"
        ? { emoji: "↩︎", text: "Not this time", color: "text-orange-300" }
        : { emoji: "🟠", text: "Help us ID", color: "text-orange-300" };

  const isContributed = outcome === "contributed";

  return (
    <motion.div
      key={outcome ?? "answered"}
      initial={outcome === "correct" ? { scale: 0.92, opacity: 0 } : { x: 0, opacity: 0.6 }}
      animate={
        outcome === "correct"
          ? { scale: 1, opacity: 1 }
          : outcome === "wrong"
            ? { x: [0, -8, 8, -6, 6, 0], opacity: 1 }
            : { opacity: 1 }
      }
      transition={
        outcome === "correct"
          ? { type: "spring", stiffness: 300, damping: 20 }
          : { duration: 0.4 }
      }
      className="space-y-3"
    >
      {/* Verdict line */}
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className={verdict.color}>{verdict.emoji}</span>
        <span className={verdict.color}>{verdict.text}</span>
        <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-xs">
          +{myAnswer.pointsAwarded} pts
        </span>
      </div>

      {/* "You said:" line */}
      <p className="flex items-baseline gap-2 text-sm text-white/85">
        <span>You said: <span className="font-semibold text-[#DEF2F1]">{myAnswer.chosenOption}</span></span>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs text-[#DEF2F1] underline underline-offset-4 hover:text-white"
          >
            change
          </button>
        )}
      </p>

      {/* Hero card — show staff taxon when verified, or contribution view */}
      {!isContributed && taxon && (
        <TaxonHero
          taxon={taxon}
          label={outcome === "correct" ? "That's a" : "Actually it was"}
          accent={outcome === "correct" ? "green" : "orange"}
        />
      )}

      {isContributed && (
        <div className="rounded-2xl border border-orange-400/40 bg-orange-400/10 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-300">
            Thank you for contributing
          </p>
          <p className="mt-2 text-sm text-white/85">
            This clip doesn&apos;t have a verified ID yet — you&apos;re helping label it.
            See what others guessed below.
          </p>
        </div>
      )}

      {/* Community guesses */}
      {stats && stats.stats.length > 0 && (
        <div className="text-xs">
          <p className="mb-1 font-medium uppercase tracking-[0.14em] text-white/70">
            {isContributed ? "Community guesses" : "Community answers"}
          </p>
          <ul className="space-y-1">
            {stats.stats.slice(0, 4).map((s) => (
              <li key={s.option + (s.taxonId ?? "")} className="flex items-center gap-2">
                <span className="w-24 truncate">{s.option}</span>
                <span className="w-8 text-right text-white/60">{s.percent}%</span>
                <div className="h-1.5 max-w-[120px] flex-1 overflow-hidden rounded bg-white/12">
                  <div
                    className={`h-full rounded ${isContributed ? "bg-orange-400" : "bg-[#3AAFA9]"}`}
                    style={{ width: `${s.percent}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          {!isContributed && stats.total > 0 && (
            <p className="mt-1 text-white/55">{stats.total} {stats.total === 1 ? "answer" : "answers"} so far</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-white/75">
        {hasNext && (
          <motion.button
            type="button"
            onClick={onAdvance}
            whileTap={{ scale: 0.97 }}
            className="rounded-full bg-[#3AAFA9] px-4 py-2 text-sm font-semibold text-[#17252A] hover:bg-[#59c8c3]"
          >
            Next clip
          </motion.button>
        )}
        {taxon && taxon.id && !isContributed && (
          <Link
            href={`/taxon/${taxon.id}`}
            className="text-[#DEF2F1] underline underline-offset-4"
          >
            Learn more
          </Link>
        )}
        <Link href="/feed/browse" className="text-[#DEF2F1] underline underline-offset-4">
          Archive
        </Link>
      </div>
    </motion.div>
  );
}
