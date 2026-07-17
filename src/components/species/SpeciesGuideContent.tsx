"use client";

/**
 * Shared species detail content — the single source of truth for "what a species
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

export type SpeciesDepth = { label: string; medianM: number } | null;

const SIZE_LABEL: Record<string, string> = {
  small: "Small (under 10 cm)",
  medium: "Medium (10–50 cm)",
  large: "Large (over 50 cm)",
};
const prettify = (v: string) => {
  const s = v.replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const prettyList = (vs: string[]) => (vs.length ? vs.map(prettify).join(", ") : "Not recorded");

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-modal bg-surface-muted px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-eyebrow text-navy-900/70">{label}</p>
      <p className="mt-0.5 text-sm leading-snug text-navy-900">{value}</p>
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
}: {
  scientificName: string;
  commonName: string;
  fieldNote?: string;
  size: string;
  habitat: string[];
  behavior: string[];
  initialDepth?: SpeciesDepth;
  initialDistribution?: DistributionGrid | null;
}) {
  const [depth, setDepth] = useState<SpeciesDepth>(initialDepth ?? null);
  const [grid, setGrid] = useState<DistributionGrid | null>(initialDistribution ?? null);
  const [marked, setMarked] = useState<SpeciesImagePayload | null>(null);

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
  }, [scientificName, initialDepth, initialDistribution]);

  const depthValue = depth ? `${depth.label} (median ${Math.round(depth.medianM)} m)` : null;

  return (
    <div className="space-y-5">
      {/* How to spot it — annotated reference (only when marks exist). Dark card
          because the annotated legend is white. */}
      {marked && (
        <section className="rounded-card bg-navy-900 p-4">
          <h2 className="mb-3 font-brand-heading text-h3 text-white">How to spot it</h2>
          <AnnotatedSpeciesPhotoView image={marked} marks={marked.marks} commonName={commonName} />
        </section>
      )}

      {/* Field note */}
      {fieldNote && (
        <section className="pebl-surface rounded-card p-4">
          <p className="text-sm leading-7 text-navy-900/85">{fieldNote}</p>
        </section>
      )}

      {/* Field facts. Depth comes from a live OBIS cache and isn't always
          backfilled yet, so omit the row rather than show a "Not recorded"
          placeholder next to a species we clearly do have footage of. */}
      <section className="grid grid-cols-2 gap-3">
        {depthValue && <Fact label="Usually seen at" value={depthValue} />}
        <Fact label="Size" value={SIZE_LABEL[size] ?? prettify(size)} />
        <Fact label="Habitat" value={prettyList(habitat)} />
        <Fact label="Behaviour" value={prettyList(behavior)} />
      </section>

      {/* Where it's seen */}
      <section className="pebl-surface rounded-card p-4">
        <SectionTitle>Where it&apos;s seen</SectionTitle>
        <p className="mb-3 -mt-1 text-xs text-navy-900/60">
          Occurrence records around the UK &amp; north-east Atlantic (OBIS). The
          ringed marker is the PEBL filming site.
        </p>
        <div className="flex justify-center">
          <DistributionMap grid={grid} />
        </div>
      </section>

      {/* Photos */}
      <section className="pebl-surface rounded-card p-4">
        <SectionTitle>Reference photos</SectionTitle>
        <SpeciesGallery scientificName={scientificName} commonName={commonName} size="thumb" />
        <p className="mt-2 text-[11px] text-navy-900/55">Tap a photo to enlarge.</p>
      </section>
    </div>
  );
}
