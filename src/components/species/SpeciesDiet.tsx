"use client";

/**
 * "I eat / Eats me": what the literature says this animal eats, and what eats
 * it, on its own guide.
 *
 * Each bullet is a broad statement read out of a published account of the
 * species and bound to the passage it came from, so the section carries only
 * what a source actually says. Nothing here is inferred from our own catalogue
 * or from the farm food-web diagram; the earlier version was, and it produced
 * a cod that ate three of its catalogue neighbours.
 *
 * Because every bullet is evidenced, the section needs no footnote explaining
 * which parts are sourced and which are the diagram's judgement. A bullet that
 * could not be traced to a passage is not shown at all, which is the only
 * version of that promise a reader can check.
 */

import Link from "next/link";
import type { DietItem, SpeciesDiet as SpeciesDietData } from "@/lib/foodweb/diet";
import { SourceCite } from "@/components/species/SourceCite";
import type { SpeciesProvenance } from "@/lib/references/payload";

function DietRow({
  item,
  provenance,
  sourceOrder,
}: {
  item: DietItem;
  provenance: SpeciesProvenance | null;
  sourceOrder: string[];
}) {
  const claim = provenance?.claims[item.claimKey];
  const allSources = provenance?.sources ?? [];
  return (
    <li className="flex items-baseline gap-1.5 py-1">
      <span aria-hidden="true" className="mt-1.5 h-1 w-1 flex-none rounded-full bg-teal-500" />
      <span className="text-sm leading-snug text-navy-900/85">
        {item.slug ? (
          <Link
            href={`/species/${item.slug}`}
            className="underline decoration-navy-900/20 underline-offset-2 hover:decoration-teal-600 hover:text-teal-600"
          >
            {item.label}
          </Link>
        ) : (
          item.label
        )}
        <SourceCite claim={claim} order={sourceOrder} allSources={allSources} />
      </span>
    </li>
  );
}

function Column({
  title,
  items,
  emptyNote,
  provenance,
  sourceOrder,
}: {
  title: string;
  items: DietItem[];
  emptyNote: string;
  provenance: SpeciesProvenance | null;
  sourceOrder: string[];
}) {
  return (
    <div>
      <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-eyebrow text-navy-900/70">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-xs leading-relaxed text-navy-900/55">{emptyNote}</p>
      ) : (
        <ul>
          {items.map((item) => (
            <DietRow key={item.claimKey} item={item} provenance={provenance} sourceOrder={sourceOrder} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function SpeciesDiet({
  commonName,
  diet,
  provenance,
}: {
  commonName: string;
  diet: SpeciesDietData;
  provenance: SpeciesProvenance | null;
}) {
  if (diet.eats.length === 0 && diet.eatenBy.length === 0) return null;
  const sourceOrder = provenance?.sources.map((s) => s.id) ?? [];
  const allSources = provenance?.sources ?? [];

  return (
    <section className="pebl-surface rounded-card p-4">
      <h2 className="mb-3 font-brand-heading text-h3 text-navy-900">Diet</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Column
          title="I eat"
          items={diet.eats}
          // An empty column must say why it is empty, not read as a fact.
          emptyNote={`No published account of what ${commonName} eats has been traced yet.`}
          provenance={provenance}
          sourceOrder={sourceOrder}
        />
        <Column
          title="Eats me"
          items={diet.eatenBy}
          emptyNote={`No published record of a predator taking ${commonName} has been traced yet.`}
          provenance={provenance}
          sourceOrder={sourceOrder}
        />
      </div>
    </section>
  );
}
