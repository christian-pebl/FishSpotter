"use client";

/**
 * Rung 3 — the final pick, as a draggable dark gate matching Rungs 1 & 2
 * (3 Jun 2026). After the shape gate (Rung 1) and body-shape gate (Rung 2), the
 * remaining candidates are shown as a grid of tiles, each a real lead photo +
 * common name. Tapping a tile commits the guess (same `onPick` path as the MCQ).
 *
 * Decisions (see implementation/2026-06-03/rung3-candidate-gate-plan.md):
 *  - the adaptive yes/no text questions are dropped; narrowing is shape + the
 *    Rung-2 form `seed` only (silhouette-based deeper splits are a later phase),
 *  - tap commits, with easy Back to the previous rung + a breadcrumb,
 *  - photos at species level; a species with no cached photo falls back to its
 *    body-form (or shape-class) silhouette so a tile is never empty.
 */

import { useEffect, useMemo, useState } from "react";
import {
  narrowCandidates,
  speciesValuesFor,
  type TraitKey,
} from "@/lib/idguide/narrow";
import { SUB_SPLITS } from "@/lib/idflow/body-forms";
import {
  TileGate,
  MaskSilhouette,
  type TileSpec,
  type Crumb,
} from "@/components/idflow/TileGate";
import { SpeciesGuidePopup } from "@/components/idflow/SpeciesGuidePopup";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import type { ShapeClass, TraitSelection } from "@/lib/idguide/traits";
import silhouetteCredits from "@/data/silhouette-credits.json";
import bodyformCredits from "@/data/bodyform-silhouette-credits.json";

const HAS_SILHOUETTE = new Set(Object.keys(silhouetteCredits));
const HAS_FORM_SILHOUETTE = new Set(Object.keys(bodyformCredits));

// Cap the photo grid so a wide path ("Not sure" → whole catalogue) stays a
// bounded, performant grid; narrowCandidates orders by likelihood, so the cap
// keeps the most probable species. The "Pick from a list" fallback covers the
// rest.
const MAX_TILES = 24;

/** The best simple silhouette for a species when it has no cached photo:
 * its body-form silhouette, else its shape-class silhouette, else none. */
function fallbackSilhouetteSrc(
  shapeClass: ShapeClass | null,
  scientificName: string,
): string | null {
  if (!shapeClass) return null;
  const formKey = SUB_SPLITS[shapeClass]?.key;
  const traits = CATALOGUE[scientificName];
  if (formKey && traits) {
    const v = speciesValuesFor(traits, formKey)[0];
    if (v && HAS_FORM_SILHOUETTE.has(v)) return `/silhouettes/forms/${v}.svg`;
  }
  if (HAS_SILHOUETTE.has(shapeClass)) return `/silhouettes/${shapeClass}.svg`;
  return null;
}

export function CandidateGate({
  shapeClass,
  seed,
  submitting,
  onPick,
  onClose,
  onBack,
  breadcrumb,
  onSkipToMCQ,
  coarse,
}: {
  /** null = "Not sure" at the shape gate: narrow the whole (weighted) catalogue. */
  shapeClass: ShapeClass | null;
  /** Rung-2 result: the sub-split trait key + chosen form (null = skipped). */
  seed?: { key: TraitKey; value: string | null };
  submitting: boolean;
  onPick: (commonName: string) => void;
  onClose: () => void;
  onBack?: () => void;
  breadcrumb?: Crumb[];
  onSkipToMCQ?: () => void;
  /** "It's just a {Fish}" — commit the coarse shape class (FeedCard supplies it
   *  only when a shape was chosen, i.e. not the "Not sure" whole-catalogue path). */
  coarse?: { label: string; onClick: () => void };
}) {
  const candidates = useMemo(
    () =>
      narrowCandidates({
        catalogue: CATALOGUE,
        shapeClass: shapeClass ?? undefined,
        mustHave: seed?.value
          ? ({ [seed.key]: [seed.value] } as TraitSelection)
          : {},
        limit: 100,
      }).slice(0, MAX_TILES),
    [shapeClass, seed?.key, seed?.value],
  );

  // The species whose guide popup is open (tap a tile -> preview -> confirm).
  // null = grid view. Tapping a tile no longer commits instantly; the popup's
  // "This is my pick" does.
  const [preview, setPreview] = useState<{
    scientificName: string;
    commonName: string;
  } | null>(null);

  // Lead photo per candidate, fetched once the gate is up. Small set. These
  // tiles render at ~330px CSS (≈660px on 2× screens), so we use the 500px
  // `url` (medium) rather than the 240px `thumbUrl` — the thumb visibly
  // upscales/blurs at this size. Route C makes `url` cheap to serve here: it's
  // an ~89KB WebP once transcoded, vs the ~340KB source JPEG.
  const [photos, setPhotos] = useState<Record<string, string | null>>({});
  const sciKey = candidates.map((c) => c.scientificName).join(",");
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      candidates.map((c) =>
        fetch(`/api/species-images/${encodeURIComponent(c.scientificName)}?limit=1`)
          .then((r) => (r.ok ? r.json() : null))
          .then(
            (d) =>
              [
                c.scientificName,
                d?.images?.[0]?.url ?? d?.images?.[0]?.thumbUrl ?? null,
              ] as const,
          )
          .catch(() => [c.scientificName, null] as const),
      ),
    ).then((entries) => {
      if (!cancelled) setPhotos(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
    // sciKey captures the candidate set; depending on the array identity churns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sciKey]);

  const tiles: TileSpec[] = candidates.map((c) => {
    const photo = photos[c.scientificName];
    const sil = fallbackSilhouetteSrc(shapeClass, c.scientificName);
    return {
      key: c.scientificName,
      label: c.commonName,
      ariaLabel: `Pick ${c.commonName}`,
      disabled: submitting,
      media: photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : sil ? (
        <span className="flex h-full w-full items-center justify-center p-3 text-teal-500/45">
          <MaskSilhouette src={sil} />
        </span>
      ) : (
        <span className="flex h-full w-full items-center justify-center text-white/20">
          <svg viewBox="0 0 48 32" fill="none" aria-hidden="true" className="w-1/2">
            <path d="M6 16c3-7 9-11 16-11 9 0 16 5 19 11-3 6-10 11-19 11-7 0-13-4-16-11z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M41 16l6-5v10l-6-5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </span>
      ),
    };
  });

  return (
    <>
      <TileGate
        ariaLabel="Which species is it?"
        title={candidates.length > 0 ? "Which one is it? Tap to compare" : "No matches"}
        tiles={tiles}
        columns={2}
        scrollable
        suspendKeyboard={!!preview}
        onSelect={(sci) => {
          const c = candidates.find((x) => x.scientificName === sci);
          // Tap opens the guide popup (gallery + diagnostic marks + field note)
          // so the user can compare before committing; the popup commits.
          if (c && !submitting) setPreview({ scientificName: c.scientificName, commonName: c.commonName });
        }}
        onClose={onClose}
        onBack={onBack}
        breadcrumb={breadcrumb}
        bubbleLabel="Reopen the species picker"
        emptyMessage="No matches left — go back a step or pick from a list."
        // An explicit "none of these match" exit at the decision point (the
        // grid can hold up to 24 near-lookalikes). "None look right" steps back
        // to re-narrow; "Pick from a list" jumps to the full MCQ.
        notSure={onBack ? { label: "None look right", onClick: onBack } : undefined}
        skip={onSkipToMCQ ? { label: "Pick from a list", onClick: onSkipToMCQ } : undefined}
        coarse={coarse}
      />
      {preview && (
        <SpeciesGuidePopup
          scientificName={preview.scientificName}
          commonName={preview.commonName}
          submitting={submitting}
          onConfirm={() => onPick(preview.commonName)}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
}
