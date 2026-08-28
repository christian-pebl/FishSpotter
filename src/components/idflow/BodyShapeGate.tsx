"use client";

/**
 * Rung 2: the body-shape sub-split, as a draggable dark card matching Rung 1
 * (3 Jun). Built on the shared TileGate "list" variant so it inherits the gate
 * chrome (drag, Hide, Back, breadcrumb, dark theme, a11y) for free. Each row is
 * a 2x body-form silhouette; a per-row chevron drops an inline examples panel
 * (real photos of catalogue species with that body type) directly below it,
 * single-open, so the user can drop one down, compare, close it, and browse the
 * next. The examples are a major identification helper; nothing there commits a
 * guess.
 *
 * Silhouettes reuse the existing PhyloPic form assets in
 * public/silhouettes/forms/<value>.svg (tinted via mask-image, same as Rung 1).
 * Christian is authoring bespoke replacement art in parallel; dropping an SVG
 * over the same filename swaps it in with no code change. Forms without an asset
 * (no-shell) show a neutral placeholder; bottom-scooter uses an original PEBL
 * silhouette (no PhyloPic UUID) registered in bodyform-silhouette-credits.json.
 */

import { useMemo, useState } from "react";
import { TileGate, MaskSilhouette, type TileSpec, type Crumb } from "@/components/idflow/TileGate";
import { BodyFormExampleList } from "@/components/idflow/BodyFormExampleList";
import { SpeciesComparison } from "@/components/idflow/SpeciesComparison";
import { bodyFormConfigFor } from "@/lib/idflow/body-forms";
import { narrowCandidates } from "@/lib/idguide/narrow";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { SHAPE_CLASS_PLURAL_NOUN } from "@/components/ShapeGate";
import { comparisonGroupForShapeClass } from "@/lib/idflow/comparisons";
import type { ShapeClass } from "@/lib/idguide/traits";
import type { TraitKey } from "@/lib/idguide/narrow";
import bodyformCredits from "@/data/bodyform-silhouette-credits.json";

// Keys present in the credits file = a real SVG exists in
// public/silhouettes/forms/<value>.svg for this form.
const HAS_FORM_SILHOUETTE = new Set(Object.keys(bodyformCredits));

/** Neutral placeholder for a form that has no silhouette asset yet. */
function FormPlaceholder() {
  return (
    <svg viewBox="0 0 40 32" fill="none" aria-hidden="true" className="h-full w-full opacity-60">
      <rect
        x="3"
        y="4"
        width="34"
        height="24"
        rx="6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeDasharray="3 3"
      />
      <path d="M14 16h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function BodyShapeGate({
  shapeClass,
  onSelectForm,
  onPickSpecies,
  submitting = false,
  onSkip,
  onClose,
  onBack,
  breadcrumb,
}: {
  shapeClass: ShapeClass;
  /** Pick a body form (value) or skip it (null). The trait key is passed back
   * so FeedCard can seed the strip's narrowing without re-deriving it, and
   * `values` carries every trait value the chosen tile covers (>1 when the tile
   * bundles forms, e.g. the merged broad-oval-crab tile). */
  onSelectForm: (key: TraitKey, value: string | null, values?: string[]) => void;
  /** Commit a species directly by common name (used by the class-level compare
   * view, where each starfish IS its arm-form, so tapping one is the guess). */
  onPickSpecies?: (commonName: string) => void;
  /** True while a guess is being submitted (disables the compare cards). */
  submitting?: boolean;
  /** "Skip to guess": jump to the MCQ fallback. */
  onSkip: () => void;
  onClose: () => void;
  /** Back to Rung 1 (the shape gate). */
  onBack?: () => void;
  /** Prior picks, for the breadcrumb. */
  breadcrumb?: Crumb[];
}) {
  const config = bodyFormConfigFor(shapeClass);

  // Class-level "compare them all" (only for a class whose every form is one
  // species, e.g. starfish). Offered only when FeedCard wired a species-commit.
  const comparison = comparisonGroupForShapeClass(shapeClass);
  const [comparing, setComparing] = useState(false);

  // Everything in this shape class, counted the way Rung 3 counts it (so the
  // number promised on the button is the number of tiles the user then gets).
  // NB not the sum of the per-form counts: a species can carry two form values
  // (a goby is both `elongated` and `bottom-scooter`) and would be counted twice.
  const classTotal = useMemo(
    () => narrowCandidates({ catalogue: CATALOGUE, shapeClass, limit: 500 }).length,
    [shapeClass],
  );

  // FeedCard only opens this gate when a config exists; guard anyway.
  if (!config) return null;

  const tiles: TileSpec[] = config.options.map((o) => ({
    key: o.value,
    label: o.label,
    badge: o.count,
    ariaLabel: `${o.label}, ${o.count} species`,
    icon: HAS_FORM_SILHOUETTE.has(o.value) ? (
      <MaskSilhouette src={`/silhouettes/forms/${o.value}.svg`} />
    ) : (
      <FormPlaceholder />
    ),
    renderExpanded: () => (
      <BodyFormExampleList
        shapeClass={shapeClass}
        formKey={config.key}
        formValue={o.values}
      />
    ),
  }));

  return (
    <>
      <TileGate
        ariaLabel={config.prompt}
        title={config.prompt}
        tiles={tiles}
        variant="list"
        suspendKeyboard={comparing}
        onSelect={(value) =>
          onSelectForm(
            config.key,
            value,
            config.options.find((o) => o.value === value)?.values,
          )
        }
        onClose={onClose}
        onBack={onBack}
        breadcrumb={breadcrumb}
        bubbleLabel="Reopen the body-shape selector"
        compare={
          comparison && onPickSpecies
            ? { label: "Compare side by side", onClick: () => setComparing(true) }
            : undefined
        }
        notSure={{
          // Same reframe as Rung 1: this opens every species in the class as a
          // photo grid, so say so. Suppressed to the plain footer link when the
          // class already offers a curated side-by-side compare (starfish),
          // which is the better version of the same move.
          label:
            comparison && onPickSpecies
              ? "Not sure"
              : `Not sure? Compare all ${classTotal} ${SHAPE_CLASS_PLURAL_NOUN[shapeClass]}`,
          prominent: !(comparison && onPickSpecies),
          onClick: () => onSelectForm(config.key, null),
        }}
        skip={{ label: "Skip to guess", onClick: onSkip }}
      />
      {comparing && comparison && onPickSpecies && (
        <SpeciesComparison
          group={comparison}
          submitting={submitting}
          // Close the comparison as the pick commits — this gate has no
          // !myAnswer unmount of its own, so a pick made from here would
          // otherwise leave the comparison (and the gate under it) covering
          // the reveal.
          onPick={(name) => {
            setComparing(false);
            onPickSpecies(name);
          }}
          onClose={() => setComparing(false)}
        />
      )}
    </>
  );
}
