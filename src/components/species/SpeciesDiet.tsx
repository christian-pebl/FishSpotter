"use client";

/**
 * "I eat / Eats me": the species' place in the farm food web, on its own guide.
 *
 * The food web page already draws all 238 feeding links at once, which is a
 * good overview and a poor answer to "what does THIS one eat". This is the
 * per-species read of the same graph, and every prey and predator that is
 * itself in the catalogue links through to its own guide, so a reader can walk
 * the web one hop at a time.
 *
 * Honesty rules built into the rendering:
 *   - an empty "eats me" list says so explicitly, and says why, rather than
 *     leaving a blank that reads as "nothing eats it";
 *   - each link carries a citation only where one exists, so a reader can see
 *     at a glance which parts of the web are evidenced and which are the
 *     diagram's own ecological judgement.
 */

import Link from "next/link";
import type { DietItem, SpeciesDiet as SpeciesDietData } from "@/lib/foodweb/diet";
import { TIER_LABEL } from "@/lib/foodweb/diet";
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
  const body = (
    <>
      {item.label}
      {item.detail && <span className="text-navy-900/50"> ({item.detail})</span>}
    </>
  );
  return (
    <li className="flex items-baseline gap-1.5 py-1">
      <span aria-hidden="true" className="mt-1.5 h-1 w-1 flex-none rounded-full bg-teal-500" />
      <span className="text-sm leading-snug text-navy-900/85">
        {item.slug ? (
          <Link
            href={`/species/${item.slug}`}
            className="underline decoration-navy-900/20 underline-offset-2 hover:decoration-teal-600 hover:text-teal-600"
          >
            {body}
          </Link>
        ) : (
          body
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
            <DietRow
              key={item.claimKey}
              item={item}
              provenance={provenance}
              sourceOrder={sourceOrder}
            />
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
  // Not every catalogue species is placed on the farm food web.
  if (!diet.foodWebName) return null;
  const sourceOrder = provenance?.sources.map((s) => s.id) ?? [];
  const allSources = provenance?.sources ?? [];

  return (
    <section className="pebl-surface rounded-card p-4">
      <h2 className="mb-1 font-brand-heading text-h3 text-navy-900">In the food web</h2>
      {diet.tier !== null && (
        <p className="mb-3 -mt-0.5 text-xs text-navy-900/60">
          {TIER_LABEL[diet.tier] ?? `Tier ${diet.tier}`}
          {/* The tier is a claim like any other, and a contested one for several
              species, so it carries its own citation rather than being stated
              as if it were a property of the diagram. */}
          <SourceCite
            claim={provenance?.claims["trophic:tier"]}
            order={sourceOrder}
            allSources={allSources}
          />
          .
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Column
          title="I eat"
          items={diet.eats}
          emptyNote={`No prey recorded for ${commonName} in this food web.`}
          provenance={provenance}
          sourceOrder={sourceOrder}
        />
        <Column
          title="Eats me"
          items={diet.eatenBy}
          // An empty column must never read as "nothing eats it".
          emptyNote={`Nothing else in this 72-species food web preys on ${commonName}. That does not mean it has no predators, only that none of them are in the catalogue.`}
          provenance={provenance}
          sourceOrder={sourceOrder}
        />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-navy-900/55">
        Feeding links from PEBL&apos;s food web for a seaweed and shellfish farm. Links with a
        number beside them are backed by a published diet record; the rest are the diagram&apos;s
        own reading of UK and north-east Atlantic ecology. The web does not claim which species the
        farm does or does not bring to a site.{" "}
        <Link href="/food-web.html" className="text-teal-600 underline underline-offset-2">
          See the whole web
        </Link>
        .
      </p>
    </section>
  );
}
