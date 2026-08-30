"use client";

/**
 * Rung 3, the final pick, as a draggable dark gate matching Rungs 1 & 2
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
import { SpeciesComparison } from "@/components/idflow/SpeciesComparison";
import { comparisonGroupForCandidates } from "@/lib/idflow/comparisons";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import type { ShapeClass, TraitSelection } from "@/lib/idguide/traits";
import silhouetteCredits from "@/data/silhouette-credits.json";
import bodyformCredits from "@/data/bodyform-silhouette-credits.json";

const HAS_SILHOUETTE = new Set(Object.keys(silhouetteCredits));
const HAS_FORM_SILHOUETTE = new Set(Object.keys(bodyformCredits));

// Cap the photo grid on a NARROWED path, so an unexpectedly wide candidate set
// stays a bounded, performant grid; narrowCandidates orders by likelihood, so
// the cap keeps the most probable species. The "Pick from a list" fallback
// covers the rest.
//
// The cap is lifted on the deliberate "compare them all" path (see `compareAll`
// below): there the count is a PROMISE made on the button the user just tapped
// ("Compare all 33 fish"), so silently showing 24 of them would be a lie. The
// widest such set is the whole catalogue (~72), each tile one edge-cached
// `?limit=1` photo lookup and a lazily-loaded image.
const MAX_TILES = 24;

// How many reference photos each tile can flick through. See the fetch below.
const TILE_PHOTOS = 6;

/** The OBIS-backed local likelihood for a clip's bucket: the bucket-wide record
 * total (for the sample-size gate) plus per-species record count + share. */
type LocalLikelihood = {
  totalRecords: number;
  byScientific: Record<string, { count: number; probability: number }>;
};

/** Which trait supplies a species' fallback silhouette. Normally the class's
 * Rung-2 sub-split trait, because that IS the shape the user just picked.
 *
 * Fish are the exception. Their Rung-2 cut moved to `fishZone` (seabed vs water
 * column) on 28 Aug 2026, and zone is a position, not a shape: keying off it
 * collapsed every photo-less fish onto one of two generic silhouettes, so a
 * catshark and a butterfish both drew the same bottom-fish blob. `fishGroup` is
 * the family gestalt and stays the authoritative source here, exactly as
 * CLAUDE.md records. */
function silhouetteTraitFor(shapeClass: ShapeClass): TraitKey | undefined {
  return shapeClass === "fish" ? "fishGroup" : SUB_SPLITS[shapeClass]?.key;
}

/** The best simple silhouette for a species when it has no cached photo:
 * its body-form silhouette, else its shape-class silhouette, else none. */
function fallbackSilhouetteSrc(
  shapeClass: ShapeClass | null,
  scientificName: string,
): string | null {
  if (!shapeClass) return null;
  const formKey = silhouetteTraitFor(shapeClass);
  const traits = CATALOGUE[scientificName];
  if (formKey && traits) {
    const v = speciesValuesFor(traits, formKey)[0];
    if (v && HAS_FORM_SILHOUETTE.has(v)) return `/silhouettes/forms/${v}.svg`;
  }
  if (HAS_SILHOUETTE.has(shapeClass)) return `/silhouettes/${shapeClass}.svg`;
  return null;
}

export function CandidateGate({
  snippetId,
  shapeClass,
  seed,
  submitting,
  onPick,
  onClose,
  onBack,
  breadcrumb,
  onSkipToMCQ,
  coarse,
  ruledOut = [],
  onRuleOut,
  onRestore,
  onRestoreAll,
}: {
  /** The clip being identified, keys the ecological-likelihood lookup (OBIS
   * probability for this clip's location/depth/month bucket). */
  snippetId: string;
  /** null = "Not sure" at the shape gate: narrow the whole (weighted) catalogue. */
  shapeClass: ShapeClass | null;
  /** Rung-2 result: the sub-split trait key + chosen form (null = skipped). */
  seed?: { key: TraitKey; value: string | null; values?: string[] | null };
  submitting: boolean;
  onPick: (commonName: string) => void;
  onClose: () => void;
  onBack?: () => void;
  breadcrumb?: Crumb[];
  onSkipToMCQ?: () => void;
  /** "It's just a {Fish}", commit the coarse shape class (FeedCard supplies it
   *  only when a shape was chosen, i.e. not the "Not sure" whole-catalogue path). */
  coarse?: { label: string; onClick: () => void };
  /** Scientific names the user has eliminated from this bucket (owned by the
   *  flow reducer so they survive a step back to an earlier rung and forward
   *  again). A pure view filter: nothing here reaches the server, and scoring
   *  and consensus are untouched. */
  ruledOut?: string[];
  onRuleOut?: (scientificName: string) => void;
  onRestore?: (scientificName: string) => void;
  onRestoreAll?: () => void;
}) {
  // Ecological likelihood for THIS clip's bucket (location · depth · month),
  // from the OBIS-backed probability cache. null until it resolves / when the
  // bucket has no data. Drives BOTH the grid ranking (most-likely-here first)
  // and the compare view's per-species likelihood bars + info bullets. We keep
  // the per-species record COUNT and the bucket-wide total so the compare view
  // can gate on sample size and show honest "N records" bullets rather than a
  // single effort-biased percentage.
  const [local, setLocal] = useState<LocalLikelihood | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/snippets/${encodeURIComponent(snippetId)}/probability`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d || d.status !== "OK" || !Array.isArray(d.species)) return;
        const byScientific: Record<string, { count: number; probability: number }> = {};
        for (const s of d.species) {
          if (s && typeof s.scientificName === "string" && typeof s.probability === "number") {
            byScientific[s.scientificName] = {
              count: typeof s.count === "number" ? s.count : 0,
              probability: s.probability,
            };
          }
        }
        setLocal({
          totalRecords: typeof d.totalRecords === "number" ? d.totalRecords : 0,
          byScientific,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [snippetId]);

  // Flatten to {scientificName -> probability} for narrowCandidates' ordering.
  const probByScientific = useMemo(
    () =>
      local
        ? Object.fromEntries(
            Object.entries(local.byScientific).map(([k, v]) => [k, v.probability]),
          )
        : null,
    [local],
  );

  // The user got here by asking to see everything in a bucket rather than by
  // narrowing into it: either "Compare all N species" at Rung 1 (no shape) or
  // "Compare all N crabs" at Rung 2 (a shape, but the form deliberately left
  // unset). Both are the only routes that produce these shapes of input, so the
  // flag is derived here rather than threaded through FeedCard.
  const compareAll = shapeClass === null || (!!seed && seed.value === null);
  // Stable dep for the bundled-tile values (an array literal would be a new
  // reference every render and re-narrow the whole catalogue on each one).
  const seedValuesKey = seed?.values?.join("|") ?? "";

  const candidates = useMemo(() => {
    const ranked = narrowCandidates({
      catalogue: CATALOGUE,
      shapeClass: shapeClass ?? undefined,
      mustHave: seed?.value
        ? ({ [seed.key]: seed.values ?? [seed.value] } as TraitSelection)
        : {},
      probabilityByScientific: probByScientific ?? undefined,
      limit: 500,
    });
    return compareAll ? ranked : ranked.slice(0, MAX_TILES);
    // seedValuesKey is the stable stand-in for seed.values (an array literal
    // would be a fresh reference every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapeClass, seed?.key, seed?.value, seedValuesKey, probByScientific, compareAll]);

  // What the user has not eliminated. Deliberately filters the ALREADY-CAPPED
  // set rather than back-filling from species 25+: new tiles appearing as you
  // eliminate would break the "narrow it down" model, and "Pick from a list"
  // remains the escape hatch to the full catalogue.
  const ruledOutSet = useMemo(() => new Set(ruledOut), [ruledOut]);
  const visible = useMemo(
    () => candidates.filter((c) => !ruledOutSet.has(c.scientificName)),
    [candidates, ruledOutSet],
  );
  // Names for the footer chips, in the order the grid had them.
  const ruledOutItems = useMemo(
    () =>
      candidates
        .filter((c) => ruledOutSet.has(c.scientificName))
        .map((c) => ({ key: c.scientificName, label: c.commonName })),
    [candidates, ruledOutSet],
  );

  // The species whose guide popup is open (tap a tile -> preview -> confirm).
  // null = grid view. Tapping a tile no longer commits instantly; the popup's
  // "This is my pick" does.
  const [preview, setPreview] = useState<{
    scientificName: string;
    commonName: string;
  } | null>(null);

  // Look-alike "compare side by side" view (e.g. the three right-eyed flatfish).
  // Offered only when the remaining candidates are a known confusion group.
  // Computed from the VISIBLE set: once you have ruled out one of a look-alike
  // group, "compare these three side by side" is no longer the offer being made.
  const comparison = useMemo(
    () => comparisonGroupForCandidates(visible.map((c) => c.scientificName)),
    [visible],
  );
  const [comparing, setComparing] = useState(false);

  // Reference photos per candidate, fetched once the gate is up. These tiles
  // render at ~330px CSS (≈660px on 2× screens), so we use the 500px `url`
  // (medium) rather than the 240px `thumbUrl`, the thumb visibly upscales/blurs
  // at this size. Route C makes `url` cheap to serve here: it's an ~89KB WebP
  // once transcoded, vs the ~340KB source JPEG.
  //
  // TILE_PHOTOS > 1 (28 Aug 2026) is what makes the tile picture a comparison
  // viewer: tap its halves to flick between shots of the same species while the
  // clip plays beside it, instead of opening the guide to see a second angle.
  // It costs no extra requests (the same one call per species, `?limit=N`) and
  // no extra images up front, because TileGate mounts only the visible frame;
  // the rest load when the user asks for them. Six is the useful ceiling: the
  // gallery builder targets 8 per species, and past ~6 the tail is redundant
  // angles rather than a different look at the animal.
  const [photos, setPhotos] = useState<Record<string, string[]>>({});
  const sciKey = candidates.map((c) => c.scientificName).join(",");
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      candidates.map((c) =>
        fetch(
          `/api/species-images/${encodeURIComponent(c.scientificName)}?limit=${TILE_PHOTOS}`,
        )
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            const urls: string[] = Array.isArray(d?.images)
              ? d.images
                  .map((img: { url?: string; thumbUrl?: string }) => img?.url ?? img?.thumbUrl)
                  .filter((u: unknown): u is string => typeof u === "string" && u.length > 0)
              : [];
            return [c.scientificName, urls] as const;
          })
          .catch(() => [c.scientificName, [] as string[]] as const),
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

  const tiles: TileSpec[] = visible.map((c) => {
    const strip = photos[c.scientificName] ?? [];
    const sil = fallbackSilhouetteSrc(shapeClass, c.scientificName);
    return {
      key: c.scientificName,
      label: c.commonName,
      ariaLabel: `Pick ${c.commonName}`,
      disabled: submitting,
      // TileGate renders the picture from `photos` when there is one, and falls
      // back to `media` (silhouette / line art) while they load or when the
      // species has none cached.
      photos: strip,
      media: sil ? (
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
        title={
          visible.length === 0
            ? "No matches"
            : compareAll
              ? `All ${visible.length}, most likely first. Tap a photo`
              : "Which one is it? Tap a photo"
        }
        tiles={tiles}
        columns={2}
        // A phone gets three across rather than two. The tiles are smaller, but
        // this rung is a scanning task before it is a looking-closely task, and
        // the tile picture is now a viewer you can flick and open, so what the
        // grid owes the user is BREADTH: how many candidates are on screen at
        // once. Two columns put roughly one row in a phone sheet.
        phoneColumns={3}
        suspendKeyboard={!!preview}
        onRuleOut={onRuleOut}
        ruledOut={
          onRestore && onRestoreAll && ruledOutItems.length > 0
            ? { items: ruledOutItems, onRestore, onRestoreAll }
            : undefined
        }
        onSelect={(sci) => {
          const c = visible.find((x) => x.scientificName === sci);
          // Tap opens the guide popup (gallery + diagnostic marks + field note)
          // so the user can compare before committing; the popup commits.
          if (c && !submitting) setPreview({ scientificName: c.scientificName, commonName: c.commonName });
        }}
        onClose={onClose}
        onBack={onBack}
        breadcrumb={breadcrumb}
        bubbleLabel="Reopen the species picker"
        emptyMessage={
          ruledOutItems.length > 0
            ? "You have ruled them all out. Bring some back below, go back a step, or pick from a list."
            : "No matches left. Go back a step or pick from a list."
        }
        // An explicit "none of these match" exit at the decision point. "None
        // look right" steps back to re-narrow; "Pick from a list" jumps to the
        // full MCQ. On the compare-them-all path there is nothing left to
        // re-narrow to, so it reads as a plain step back instead.
        notSure={
          onBack
            ? { label: compareAll ? "Go back a step" : "None look right", onClick: onBack }
            : undefined
        }
        skip={onSkipToMCQ ? { label: "Pick from a list", onClick: onSkipToMCQ } : undefined}
        compare={
          comparison
            ? { label: "Compare side by side", onClick: () => setComparing(true) }
            : undefined
        }
        coarse={coarse}
      />
      {preview && (
        <SpeciesGuidePopup
          scientificName={preview.scientificName}
          commonName={preview.commonName}
          submitting={submitting}
          onConfirm={() => onPick(preview.commonName)}
          onRuleOut={
            onRuleOut
              ? () => {
                  onRuleOut(preview.scientificName);
                  setPreview(null);
                }
              : undefined
          }
          onClose={() => setPreview(null)}
        />
      )}
      {comparing && comparison && (
        <SpeciesComparison
          group={comparison}
          submitting={submitting}
          local={local ?? undefined}
          onPick={onPick}
          onClose={() => setComparing(false)}
        />
      )}
    </>
  );
}
