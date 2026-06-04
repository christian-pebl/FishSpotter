"use client";

/**
 * Rung 2 — the body-shape sub-split, as a draggable dark card matching Rung 1
 * (3 Jun). Built on the shared TileGate "list" variant so it inherits the gate
 * chrome (drag, Hide, Back, breadcrumb, dark theme, a11y) for free. Each row is
 * a 2x body-form silhouette; a per-row chevron drops an inline examples panel
 * (real photos of catalogue species with that body type) directly below it —
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

import { TileGate, MaskSilhouette, type TileSpec, type Crumb } from "@/components/idflow/TileGate";
import { BodyFormExampleList } from "@/components/idflow/BodyFormExampleList";
import { bodyFormConfigFor } from "@/lib/idflow/body-forms";
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
  onSkip,
  onClose,
  onBack,
  breadcrumb,
}: {
  shapeClass: ShapeClass;
  /** Pick a body form (value) or skip it (null). The trait key is passed back
   * so FeedCard can seed the strip's narrowing without re-deriving it. */
  onSelectForm: (key: TraitKey, value: string | null) => void;
  /** "Skip to guess" — jump to the MCQ fallback. */
  onSkip: () => void;
  onClose: () => void;
  /** Back to Rung 1 (the shape gate). */
  onBack?: () => void;
  /** Prior picks, for the breadcrumb. */
  breadcrumb?: Crumb[];
}) {
  const config = bodyFormConfigFor(shapeClass);

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
        formValue={o.value}
      />
    ),
  }));

  return (
    <TileGate
      ariaLabel={config.prompt}
      title={config.prompt}
      tiles={tiles}
      variant="list"
      onSelect={(value) => onSelectForm(config.key, value)}
      onClose={onClose}
      onBack={onBack}
      breadcrumb={breadcrumb}
      bubbleLabel="Reopen the body-shape selector"
      notSure={{ label: "Not sure", onClick: () => onSelectForm(config.key, null) }}
      skip={{ label: "Skip to guess", onClick: onSkip }}
    />
  );
}
