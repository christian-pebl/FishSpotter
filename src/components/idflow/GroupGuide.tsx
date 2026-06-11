"use client";

/**
 * Group guide for "How to spot a [X] next time" when the clip's reference is a
 * coarse group label (Flatfish / Fish / Crab / ...) with no single species. It
 * shows: the group silhouette + intro, 2-4 recognition cues, the member species
 * you are most likely to have seen here (likelihood-ranked, photo tiles), a
 * one-liner on telling them apart, and an honest "logged at group level" note.
 *
 * Tapping a member tile drills into that species' own field-guide card via
 * onPickSpecies (the IdGuideSheet's selectedFallback machinery), with a
 * "Back to {group}" affordance the sheet already renders.
 */

import { useEffect, useMemo, useState } from "react";
import { narrowCandidates } from "@/lib/idguide/narrow";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { MaskSilhouette } from "@/components/idflow/TileGate";
import { SHAPE_CLASS_GUIDES } from "@/data/shape-class-guides";
import type { ShapeClass } from "@/lib/idguide/traits";

// "Fish" is the only group big enough to need capping; the rest (<=6) all show.
const MAX_MEMBERS = 8;

export function GroupGuide({
  shapeClass,
  snippetId,
  onPickSpecies,
}: {
  shapeClass: ShapeClass;
  snippetId: string;
  onPickSpecies: (scientificName: string) => void;
}) {
  const guide = SHAPE_CLASS_GUIDES[shapeClass];

  // Likelihood prior from the clip's location / depth / month so the members
  // shown are the ones you are most likely to have just seen (matters most for
  // the broad "Fish" group). Falls back to alphabetical when the bucket is
  // uncached (INSUFFICIENT_DATA) or the fetch fails.
  const [probs, setProbs] = useState<Record<string, number>>({});
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/snippets/${encodeURIComponent(snippetId)}/probability`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { status?: string; species?: Array<{ scientificName: string; probability: number }> } | null) => {
        if (cancelled || !body || body.status !== "OK" || !body.species) return;
        const map: Record<string, number> = {};
        for (const s of body.species) map[s.scientificName] = s.probability;
        setProbs(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [snippetId]);

  const members = useMemo(
    () =>
      narrowCandidates({
        catalogue: CATALOGUE,
        shapeClass,
        probabilityByScientific: probs,
        limit: MAX_MEMBERS,
      }),
    [shapeClass, probs],
  );

  // Lead photo per member (mirrors CandidateGate's per-tile fetch).
  const [photos, setPhotos] = useState<Record<string, string | null>>({});
  const sciKey = members.map((m) => m.scientificName).join(",");
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      members.map((m) =>
        fetch(`/api/species-images/${encodeURIComponent(m.scientificName)}?limit=1`)
          .then((r) => (r.ok ? r.json() : null))
          .then(
            (d) =>
              [m.scientificName, d?.images?.[0]?.url ?? d?.images?.[0]?.thumbUrl ?? null] as const,
          )
          .catch(() => [m.scientificName, null] as const),
      ),
    ).then((entries) => {
      if (!cancelled) setPhotos(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sciKey captures the member set
  }, [sciKey]);

  return (
    <div className="mx-auto max-w-2xl">
      {/* Group header: silhouette + one-line framing. */}
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center text-teal-400">
          <MaskSilhouette src={`/silhouettes/${shapeClass}.svg`} />
        </span>
        <p className="text-sm leading-relaxed text-white/85">{guide.intro}</p>
      </div>

      {/* Recognition cues. */}
      <div className="mt-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-teal-300/80">
          What to look for
        </p>
        <ul className="space-y-1.5">
          {guide.cues.map((cue) => (
            <li key={cue} className="flex gap-2 text-[13px] leading-snug text-white/85">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="mt-0.5 shrink-0 text-teal-400">
                <path d="M3 8.5l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{cue}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Member species (tap to drill into the species card). */}
      {members.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-teal-300/80">
            The ones to expect here
          </p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {members.map((m) => {
              const photo = photos[m.scientificName];
              return (
                <li key={m.scientificName}>
                  <button
                    type="button"
                    onClick={() => onPickSpecies(m.scientificName)}
                    aria-label={`How to spot the ${m.commonName}`}
                    className="group block w-full text-left"
                  >
                    <div className="relative aspect-square overflow-hidden rounded-modal border border-white/10 bg-navy-900">
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element -- external iNat thumb
                        <img
                          src={photo}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center p-3 text-teal-500/40">
                          <MaskSilhouette src={`/silhouettes/${shapeClass}.svg`} />
                        </span>
                      )}
                    </div>
                    <p
                      className="mt-1 truncate text-[11px] font-medium text-white/85 group-hover:text-teal-200"
                      title={m.commonName}
                    >
                      {m.commonName}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2.5 text-[12px] leading-snug text-white/65">
            <span className="font-semibold text-white/80">Telling them apart: </span>
            {guide.tellApart}
          </p>
        </div>
      )}

      <p className="mt-4 text-[11px] italic text-white/40">
        This clip was logged as a {guide.label.toLowerCase()}, the exact species was not pinned down.
      </p>
    </div>
  );
}
