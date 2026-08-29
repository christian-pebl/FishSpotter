"use client";

/**
 * Shared species detail content, the single source of truth for "what a species
 * looks like, where it's seen, and how to spot it". Rendered identically by:
 *   - the menu path: the /species/[slug] profile page, and
 *   - the rung path: the SpeciesGuidePopup (which only adds a "This is my pick"
 *     button around this).
 * Keeping one component means the two can never drift apart.
 *
 * Light theme (the canonical "Species guide" surface). The "How to spot it"
 * annotated photo keeps its dark card (its legend is white) within the light
 * layout. Depth + distribution are fetched client-side, but the server can pass
 * `initialDepth` / `initialDistribution` (the profile page does, for SSR/ISR) to
 * skip the fetch.
 */

import { useEffect, useState } from "react";
import { AnnotatedSpeciesPhotoView } from "@/components/AnnotatedSpeciesPhoto";
import { SpeciesGallery } from "@/components/SpeciesGallery";
import { DistributionMap } from "@/components/species/DistributionMap";
import type { DistributionGrid } from "@/lib/biodiversity/distribution";
import type { SpeciesImagePayload } from "@/app/api/species-images/[scientificName]/route";
import { SpeciesIdentityLine, SpeciesSources } from "@/components/species/SpeciesSources";
import { SourceCite } from "@/components/species/SourceCite";
import { SpeciesDiet } from "@/components/species/SpeciesDiet";
import type { SpeciesDiet as SpeciesDietData } from "@/lib/foodweb/diet";
import type { ClaimPayload, SourcePayload, SpeciesProvenance } from "@/lib/references/payload";
import { factClaimKey, getSpeciesFacts, type SpeciesFactKey } from "@/lib/biodiversity/species-facts";

/**
 * Kept as an export for the profile page's prop, which still passes a depth in.
 * The tile no longer reads it: depth is one of the four sourced facts now.
 */
export type SpeciesDepth = { label: string; detail?: string; sourceId: string } | null;

/**
 * One fact tile. It renders ONLY when its claim carries a passage somebody
 * read.
 *
 * The page used to show every tile and mark the sourced ones, with a note at
 * the foot admitting that an unmarked statement had not been traced. That note
 * is gone, so the tiles have to keep the promise themselves: an unsourced size
 * or habitat is not shown at all. A missing tile is a smaller loss than a
 * confident-looking one nobody can check.
 */
function Fact({
  label,
  value,
  claim,
  order,
  allSources,
}: {
  label: string;
  value: string | undefined;
  claim: ClaimPayload | undefined;
  order: string[];
  allSources: SourcePayload[];
}) {
  if (!value || !claim?.evidenced) return null;
  const markers = <SourceCite claim={claim} order={order} allSources={allSources} />;
  return (
    <div className="rounded-modal bg-surface-muted px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-eyebrow text-navy-900/70">{label}</p>
      <p className="mt-0.5 text-sm leading-snug text-navy-900">
        {value}
        {markers}
      </p>
    </div>
  );
}

const FACT_TILES: { key: SpeciesFactKey; label: string }[] = [
  { key: "depth", label: "Depth" },
  { key: "size", label: "Size" },
  { key: "habitat", label: "Habitat" },
  { key: "behaviour", label: "Behaviour" },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 font-brand-heading text-h3 text-navy-900">{children}</h2>;
}

export function SpeciesGuideContent({
  scientificName,
  commonName,
  fieldNote,
  initialDistribution,
  initialProvenance,
  diet,
}: {
  scientificName: string;
  commonName: string;
  fieldNote?: string;
  initialDistribution?: DistributionGrid | null;
  /** Server-supplied provenance; the popup path fetches it instead. */
  initialProvenance?: SpeciesProvenance | null;
  /** Feeding links from the farm food web. Derived data, so always server-supplied. */
  diet?: SpeciesDietData | null;
}) {
  const [grid, setGrid] = useState<DistributionGrid | null>(initialDistribution ?? null);
  const [marked, setMarked] = useState<SpeciesImagePayload | null>(null);
  const [provenance, setProvenance] = useState<SpeciesProvenance | null>(initialProvenance ?? null);
  const [dietData, setDietData] = useState<SpeciesDietData | null>(diet ?? null);

  useEffect(() => {
    let cancelled = false;
    // Annotated reference (only shown when the species has authored marks).
    fetch(`/api/species-images/${encodeURIComponent(scientificName)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { images?: SpeciesImagePayload[] } | null) => {
        if (cancelled) return;
        setMarked(body?.images?.find((i) => i.marks.length > 0) ?? null);
      })
      .catch(() => {});
    // Provenance (skip if the server already provided it). Kept server-side
    // rather than bundled so the reference catalogue does not ship to the client.
    if (initialProvenance === undefined) {
      fetch(`/api/species/references?name=${encodeURIComponent(scientificName)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((b: { provenance?: SpeciesProvenance | null; diet?: SpeciesDietData | null } | null) => {
          if (cancelled) return;
          if (b?.provenance) setProvenance(b.provenance);
          if (b?.diet) setDietData(b.diet);
        })
        .catch(() => {});
    }
    // Distribution grid (skip if the server already provided it).
    if (initialDistribution === undefined) {
      fetch(`/api/species/distribution?name=${encodeURIComponent(scientificName)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((b: { grid?: DistributionGrid | null } | null) => {
          if (!cancelled && b?.grid) setGrid(b.grid);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [scientificName, initialDistribution, initialProvenance]);

  // Numbering for the superscript markers must match the Sources list order.
  const sourceOrder = provenance?.sources.map((s) => s.id) ?? [];
  const allSources = provenance?.sources ?? [];
  /**
   * The rings that survive verification, and the single citation for all of
   * them.
   *
   * A ring's description is a teaching claim like any other, so a ring whose
   * description could not be traced to a passage is not drawn. Rings are
   * renumbered by the annotator from whatever list it is given, so dropping one
   * leaves no gap in the legend.
   *
   * Every surviving ring rests on the same morphology passages (the source's
   * Description / Identifying features), so the block carries ONE citation
   * rather than repeating an identical superscript on each ring.
   */
  const verifiedMarks = (marked?.marks ?? []).filter(
    (m) => provenance?.claims[`mark:${m.id}`]?.evidenced,
  );
  const markClaim = (() => {
    const entries = verifiedMarks
      .map((m) => provenance?.claims[`mark:${m.id}`])
      .filter((c): c is ClaimPayload => Boolean(c));
    if (entries.length === 0) return undefined;
    const sourceIds = Array.from(new Set(entries.flatMap((c) => c.sourceIds)));
    const seen = new Set<string>();
    const support = entries
      .flatMap((c) => c.support)
      .filter((sp) => {
        const k = `${sp.sourceId} :: ${sp.locator}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    return {
      sourceIds,
      support,
      evidenced: true,
      conflict: entries.find((c) => c.conflict)?.conflict,
    };
  })();

  const facts = getSpeciesFacts(scientificName);

  return (
    <div className="space-y-5">
      <SpeciesIdentityLine provenance={provenance} />
      {/* How to spot it, annotated reference (only when marks exist). Dark card
          because the annotated legend is white. */}
      {marked && verifiedMarks.length > 0 && (
        <section className="rounded-card bg-navy-900 p-4">
          <h2 className="mb-3 font-brand-heading text-h3 text-white">
            How to spot it
            <SourceCite claim={markClaim} order={sourceOrder} allSources={allSources} tone="dark" />
          </h2>
          <AnnotatedSpeciesPhotoView image={marked} marks={verifiedMarks} commonName={commonName} />
        </section>
      )}

      {/* Photos, right below the annotated diagram: a real photo is the best
          way to confirm what it actually looks like, so it follows straight
          on from "how to spot it" rather than sitting at the foot of the page. */}
      <section className="pebl-surface rounded-card p-4">
        <SectionTitle>Reference photos</SectionTitle>
        <SpeciesGallery scientificName={scientificName} commonName={commonName} size="large" layout="grid" theme="light" />
        <p className="mt-2 text-[11px] text-navy-900/55">Tap a photo to enlarge.</p>
      </section>

      {/* Field note: only when there's no annotated diagram above, since the
          diagram's numbered legend already covers the same visual-ID ground. */}
      {verifiedMarks.length === 0 && fieldNote && provenance?.claims["fieldNote"]?.evidenced && (
        <section className="pebl-surface rounded-card p-4">
          <p className="text-sm leading-7 text-navy-900/85">
            {fieldNote}
            <SourceCite claim={provenance.claims["fieldNote"]} order={sourceOrder} allSources={allSources} />
          </p>
        </section>
      )}

      {/* The four fact tiles. Each is a phrase read out of a published source,
          not a rendering of the wizard's trait tokens: those tokens exist to
          cut a candidate list and cannot say what a source says. A fact with no
          read passage behind it is not shown. */}
      <section className="grid grid-cols-2 gap-3 empty:hidden">
        {FACT_TILES.map(({ key, label }) => (
          <Fact
            key={key}
            label={label}
            value={facts?.[key]?.text}
            claim={provenance?.claims[factClaimKey(key)]}
            order={sourceOrder}
            allSources={allSources}
          />
        ))}
      </section>

      {/* In the food web: what it eats and what eats it. */}
      {dietData && <SpeciesDiet commonName={commonName} diet={dietData} provenance={provenance} />}

      {/* Where you'd find it: the map states its claim in words first. */}
      <section className="pebl-surface rounded-card p-4">
        <SectionTitle>Where you&apos;d find it</SectionTitle>
        <DistributionMap grid={grid} />
      </section>

      {/* Sources: what the page claims, and who says so. */}
      <SpeciesSources provenance={provenance} />
    </div>
  );
}
