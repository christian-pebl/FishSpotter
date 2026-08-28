"use client";

/**
 * The provenance block on the species guide: what we claim, and who says so.
 *
 * Three parts, in the order a reader needs them:
 *   1. the taxonomic anchor (accepted name + authority, linked to WoRMS), which
 *      is what makes every other citation addressable;
 *   2. the numbered source list, each an outbound link with its publisher,
 *      licence and the date the link was last proved to be about this species;
 *   3. a short, honest note on what is sourced and what is not.
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
  const { sources, summary } = provenance;

  return (
    <section id="species-sources" className="pebl-surface rounded-card p-4">
      <h2 className="mb-1 font-brand-heading text-h3 text-navy-900">Sources</h2>
      <p className="mb-2 text-xs leading-relaxed text-navy-900/60">
        Open-access references behind this page. Each was checked on the date shown, and confirmed
        then to be about this species.
      </p>
      <ul className="divide-y divide-border">
        {sources.map((s, i) => (
          <SourceRow key={s.id} source={s} index={i} />
        ))}
      </ul>

      {/* The honesty note. It is deliberately specific about what is NOT yet
          sourced, because a bare "sources" heading implies more than we have. */}
      <div className="mt-3 rounded-modal bg-surface-muted px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-eyebrow text-navy-900/70">
          How we know this
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-navy-900/70">
          Photographs carry their own credit and licence. The depth range is read from a published
          source like everything else here, and is left off entirely for the species where no source
          states one. The map is different: it is calculated by PEBL from occurrence records held by
          OBIS, so it shows where people have looked as much as where an animal lives. Where a
          statement on this page has no number beside it, it has not yet been traced to a published
          source, and we would rather say so than imply otherwise.
        </p>
        {summary.conflicts > 0 && (
          <p className="mt-1.5 text-[11px] leading-relaxed text-incorrect-ink">
            {summary.conflicts === 1
              ? "One statement on this page is marked because the source we found disagrees with it."
              : `${summary.conflicts} statements on this page are marked because the sources we found disagree with them.`}{" "}
            We would rather show the disagreement than quietly leave the wording standing.
          </p>
        )}
        {summary.claimsEvidenced < summary.claimsBound && (
          <p className="mt-1.5 text-[11px] leading-relaxed text-navy-900/70">
            {summary.claimsEvidenced} of {summary.claimsBound} sourced statements have been checked
            line by line against the passage that supports them. The rest are matched to the right
            section and awaiting that check.
          </p>
        )}
      </div>
    </section>
  );
}
