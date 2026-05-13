"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface TaxonTile {
  id: string;
  name: string;
  scientificName: string | null;
  isFunctionalGroup: boolean;
  heroImageUrl: string | null;
  funFact: string | null;
  status: "spotted" | "contributed" | "locked";
  count: number;
  lastSeen: string | null;
  lastSite: string | null;
}

interface Totals {
  spotted: number;
  contributed: number;
  total: number;
}

function emojiForName(n: string): string {
  const lc = n.toLowerCase();
  if (lc.includes("crab")) return "🦀";
  if (lc.includes("jelly") || lc.includes("ctenophora")) return "🪼";
  if (lc.includes("squid")) return "🦑";
  if (lc.includes("starfish")) return "⭐";
  if (lc.includes("whelk") || lc.includes("snail") || lc.includes("gastropod")) return "🐚";
  if (lc.includes("shark") || lc.includes("nursehound") || lc.includes("catshark")) return "🦈";
  return "🐟";
}

function TaxonCard({ taxon }: { taxon: TaxonTile }) {
  const isLocked = taxon.status === "locked";
  const isContributed = taxon.status === "contributed";

  const inner = (
    <div
      className={`flex h-full flex-col rounded-2xl border p-3 transition ${
        isLocked
          ? "border-[color:var(--border)] bg-[color:var(--surface-muted)] opacity-60"
          : isContributed
            ? "border-orange-300/60 bg-orange-50 hover:border-orange-400"
            : "border-[color:var(--primary)]/40 bg-[color:var(--primary)]/5 hover:border-[color:var(--primary)]"
      }`}
    >
      <div className="mb-2 flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-[color:var(--surface)]">
        {isLocked ? (
          <span className="text-3xl text-[color:var(--muted)]">?</span>
        ) : taxon.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={taxon.heroImageUrl} alt={taxon.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-4xl">{emojiForName(taxon.name)}</span>
        )}
      </div>
      <p className={`truncate text-sm font-semibold ${isLocked ? "text-[color:var(--muted)]" : "text-[color:var(--foreground)]"}`}>
        {isLocked ? "???" : taxon.name}
      </p>
      {!isLocked && taxon.scientificName && (
        <p className="truncate text-xs italic text-[color:var(--muted)]">{taxon.scientificName}</p>
      )}
      {!isLocked && (
        <p className="mt-1 text-xs text-[color:var(--muted)]">
          {isContributed ? "Helped ID" : "Spotted"} ×{taxon.count}
        </p>
      )}
    </div>
  );

  if (isLocked) return inner;
  return (
    <Link href={`/taxon/${taxon.id}`} className="block">
      {inner}
    </Link>
  );
}

export default function MyTaxaPage() {
  const [data, setData] = useState<{ taxa: TaxonTile[]; totals: Totals } | null>(null);
  const [tab, setTab] = useState<"all" | "spotted" | "contributed">("all");

  useEffect(() => {
    fetch("/api/me/taxa")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6 text-[color:var(--foreground)]">
        Loading…
      </main>
    );
  }

  const filtered = data.taxa.filter((t) => {
    if (tab === "spotted") return t.status === "spotted";
    if (tab === "contributed") return t.status === "contributed";
    return true;
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 text-[color:var(--foreground)]">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">Your taxa</p>
        <h1 className="font-brand-heading text-3xl">Life list</h1>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          🟢 <span className="font-semibold text-[color:var(--foreground)]">{data.totals.spotted}</span> spotted
          {" · "}
          🟠 <span className="font-semibold text-[color:var(--foreground)]">{data.totals.contributed}</span> helped ID
          {" · "}
          <span className="text-[color:var(--muted)]">of {data.totals.total} total</span>
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", "spotted", "contributed"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === t
                ? "bg-[color:var(--primary)] text-[color:var(--surface)]"
                : "border border-[color:var(--border)] text-[color:var(--foreground)] hover:border-[color:var(--primary)]"
            }`}
          >
            {t === "all" ? "All" : t === "spotted" ? "Spotted" : "Helped ID"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {filtered.map((t) => (
          <TaxonCard key={t.id} taxon={t} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-8 text-center text-sm text-[color:var(--muted)]">
          {tab === "spotted"
            ? "No correct identifications yet. Head to the live feed and start spotting!"
            : tab === "contributed"
              ? "Help ID a clip to add to this list — every contribution earns +5 points."
              : "No taxa yet."}
        </p>
      )}
    </main>
  );
}
