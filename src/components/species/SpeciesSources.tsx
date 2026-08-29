"use client";

/**
 * The provenance block on the species guide: what we claim, and who says so.
 *
 * Three parts, in the order a reader needs them:
 *   1. the taxonomic anchor (accepted name + authority, linked to WoRMS), which
 *      is what makes every other citation addressable;
 *   2. the numbered source list, each an outbound link with its publisher,
 *      licence and the date the link was last proved to be about this species;
 * There used to be a third part: a note admitting which statements on the page
 * were not yet traced to a source. It is gone because the thing it apologised
 * for is gone. Every claim the guide renders now carries a passage somebody
 * read, and a claim that could not be evidenced is removed rather than shown
 * with a caveat, so a disclaimer would be describing a state the page can no
 * longer be in.
 *
 * Every source shown here has PASSED verification. Anything unverified is held
 * back upstream in the payload rather than rendered with a caveat, because a
 * citation that does not resolve reads as diligence while being the opposite.
 */

import type { SourcePayload, SpeciesProvenance } from "@/lib/references/payload";

/** Publisher-facing short label for the source list. */
const KIND_LABEL: Record<string, string> = {
  worms: "Taxonomy",
  marlin: "MarLIN",
  fishbase: "FishBase",
  sealifebase: "SeaLifeBase",
  fao: "FAO",
  bto: "BTO",
  scos: "SCOS",
  obis: "OBIS",
  plymsea: "PlymSea",
  bhl: "BHL",
  "guide-pdf": "ID guide",
  book: "Book",
  journal: "Paper",
  "pebl-observation": "PEBL footage",
  web: "Web",
};

// The superscript marker moved to SourceCite.tsx when it stopped being a link
// to the bottom of the page and became a card that opens the source in place.
function SourceRow({ source, index }: { source: SourcePayload; index: number }) {
  const label = KIND_LABEL[source.kind] ?? source.kind;
  return (
    <li className="flex gap-2.5 py-2">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-surface-muted text-[10px] font-semibold text-navy-900"
      >
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-relaxed text-navy-900/85">
          {source.url ? (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-teal-600 underline decoration-teal-600/30 underline-offset-2 hover:decoration-teal-600"
            >
              {source.title}
            </a>
          ) : (
            <span className="font-medium">{source.title}</span>
          )}
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-navy-900/55">
          {source.publisher}
          {source.year ? ` (${source.year})` : ""}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-navy-900/70">
            {label}
          </span>
          {source.licence && (
            <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-navy-900/70">
              {source.licence}
            </span>
          )}
          {source.checkedOn && (
            <span className="text-[9px] text-navy-900/45">link checked {source.checkedOn}</span>
          )}
        </p>
      </div>
    </li>
  );
}

export function SpeciesIdentityLine({ provenance }: { provenance: SpeciesProvenance | null }) {
  const id = provenance?.identity;
  if (!id) return null;
  return (
    <p className="text-xs leading-relaxed text-navy-900/60">
      <span className="italic">{id.acceptedName}</span>
      {id.authority ? ` ${id.authority}` : ""}
      {id.family ? ` · ${id.family}` : ""}{" "}
      <a
        href={id.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-teal-600 underline decoration-teal-600/30 underline-offset-2 hover:decoration-teal-600"
      >
        WoRMS {id.aphiaId}
      </a>
    </p>
  );
}

export function SpeciesSources({ provenance }: { provenance: SpeciesProvenance | null }) {
  if (!provenance || provenance.sources.length === 0) return null;
  const { sources } = provenance;

  return (
    <section id="species-sources" className="pebl-surface rounded-card p-4">
      <h2 className="mb-1 font-brand-heading text-h3 text-navy-900">Sources</h2>
      <p className="mb-2 text-xs leading-relaxed text-navy-900/60">
        Open-access references behind this page. Every statement on this page was read out of one of
        them; anything that could not be traced to a source was taken off the page rather than left
        standing. Each link was checked on the date shown, and confirmed then to be about this species.
      </p>
      <ul className="divide-y divide-border">
        {sources.map((s, i) => (
          <SourceRow key={s.id} source={s} index={i} />
        ))}
      </ul>

    </section>
  );
}
