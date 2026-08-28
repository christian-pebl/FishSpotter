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
import type { SpeciesProvenance } from "@/lib/references/payload";

/** A depth range a source STATES, not one computed from occurrence records. */
export type SpeciesDepth = { label: string; detail?: string; sourceId: string } | null;

const SIZE_LABEL: Record<string, string> = {
  small: "Small (under 10 cm)",
  medium: "Medium (10-50 cm)",
  large: "Large (over 50 cm)",
};
const prettify = (v: string) => {
  const s = v.replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const prettyList = (vs: string[]) => (vs.length ? vs.map(prettify).join(", ") : "Not recorded");

function Fact({
  label,
  value,
  markers,
}: {
  label: string;
  value: string;
  markers?: React.ReactNode;
}) {
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 font-brand-heading text-h3 text-navy-900">{children}</h2>;
}

export function SpeciesGuideContent({
  scientificName,
  commonName,
  fieldNote,
  size,
  habitat,
  behavior,
  initialDepth,
  initialDistribution,
  initialProvenance,
  diet,
}: {
  scientificName: string;
  commonName: string;
  fieldNote?: string;
  size: string;
  habitat: string[];
  behavior: string[];
  initialDepth?: SpeciesDepth;
  initialDistribution?: DistributionGrid | null;
  /** Server-supplied provenance; the popup path fetches it instead. */
  initialProvenance?: SpeciesProvenance | null;
  /** Feeding links from the farm food web. Derived data, so always server-supplied. */
  diet?: SpeciesDietData | null;
}) {
  const [depth, setDepth] = useState<SpeciesDepth>(initialDepth ?? null);
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
    // Depth (skip if the server already provided it).
    if (initialDepth === undefined) {
      fetch(`/api/species/depth?name=${encodeURIComponent(scientificName)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((b: { depth?: SpeciesDepth } | null) => {
          if (!cancelled && b?.depth) setDepth(b.depth);
        })
        .catch(() => {});
    }
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
  }, [scientificName, initialDepth, initialDistribution, initialProvenance]);

  // Numbering for the superscript markers must match the Sources list order.
  const sourceOrder = provenance?.sources.map((s) => s.id) ?? [];
  const allSources = provenance?.sources ?? [];
  /**
   * Every diagnostic mark on a species is backed by the same morphology
   * passages (the source's Description / Identifying features), so the block
   * carries ONE citation rather than repeating an identical superscript on
   * each ring. The claims are merged into a single synthetic one so the card
   * still shows the passages and any recorded disagreement.
   */
  const markClaim = (() => {
    const marks = Object.entries(provenance?.claims ?? {}).filter(([k]) => k.startsWith("mark:"));
    if (marks.length === 0) return undefined;
    const sourceIds = Array.from(new Set(marks.flatMap(([, c]) => c.sourceIds)));
    const seen = new Set<string>();
    const support = marks
      .flatMap(([, c]) => c.support)
      .filter((sp) => {
        const k = `${sp.sourceId} :: ${sp.locator}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    return {
      sourceIds,
      support,
      evidenced: marks.every(([, c]) => c.evidenced),
      conflict: marks.find(([, c]) => c.conflict)?.[1].conflict,
    };
  })();

  const depthValue = depth?.label ?? null;

  return (
    <div className="space-y-5">
      <SpeciesIdentityLine provenance={provenance} />
      {/* How to spot it, annotated reference (only when marks exist). Dark card
          because the annotated legend is white. */}
      {marked && (
        <section className="rounded-card bg-navy-900 p-4">
          <h2 className="mb-3 font-brand-heading text-h3 text-white">
            How to spot it
            <SourceCite claim={markClaim} order={sourceOrder} allSources={allSources} tone="dark" />
          </h2>
          <AnnotatedSpeciesPhotoView image={marked} marks={marked.marks} commonName={commonName} />
        </section>
      )}

      {/* Photos, right below the annotated diagram: a real photo is the best
          way to confirm what it actually looks like, so it follows straight
          on from "how to spot it" rather than sitting at the foot of the page. */}
      <section className="pebl-surface rounded-card p-4">
        <SectionTitle>Reference photos</SectionTitle>
        <SpeciesGallery scientificName={scientificName} commonName={commonName} size="thumb" />
        <p className="mt-2 text-[11px] text-navy-900/55">Tap a photo to enlarge.</p>
      </section>

      {/* Field note: only when there's no annotated diagram above, since the
          diagram's numbered legend already covers the same visual-ID ground. */}
      {!marked && fieldNote && (
        <section className="pebl-surface rounded-card p-4">
          <p className="text-sm leading-7 text-navy-900/85">
            {fieldNote}
            <SourceCite claim={provenance?.claims["fieldNote"]} order={sourceOrder} allSources={allSources} />
          </p>
        </section>
      )}

      {/* Field facts. Depth comes from a live OBIS cache and isn't always
          backfilled yet, so omit the row rather than show a "Not recorded"
          placeholder next to a species we clearly do have footage of. */}
      <section className="grid grid-cols-2 gap-3">
        {depthValue && (
          <Fact
            // "Usually seen at" asserted a habit; this is a published range.
            label="Depth"
            value={depthValue}
            markers={
              <SourceCite claim={provenance?.claims["trait:depth"]} order={sourceOrder} allSources={allSources} />
            }
          />
        )}
        <Fact
          label="Size"
          value={SIZE_LABEL[size] ?? prettify(size)}
          markers={<SourceCite claim={provenance?.claims["trait:size"]} order={sourceOrder} allSources={allSources} />}
        />
        <Fact
          label="Habitat"
          value={prettyList(habitat)}
          markers={<SourceCite claim={provenance?.claims["trait:habitat"]} order={sourceOrder} allSources={allSources} />}
        />
        <Fact
          label="Behaviour"
          value={prettyList(behavior)}
          markers={<SourceCite claim={provenance?.claims["trait:behavior"]} order={sourceOrder} allSources={allSources} />}
        />
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
