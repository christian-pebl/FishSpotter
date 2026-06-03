"use client";

/**
 * Rung 2 — the body-shape sub-split, as a draggable dark card matching Rung 1
 * (3 Jun). Built on the shared TileGate so it inherits the gate chrome (drag,
 * Hide, dark theme, a11y) for free. Each tile is a body-form silhouette; under
 * each is an "Examples" button that opens BodyFormExamples (real photos of
 * catalogue species with that body type) — a major identification helper.
 *
 * Silhouettes reuse the existing PhyloPic form assets in
 * public/silhouettes/forms/<value>.svg (tinted via mask-image, same as Rung 1).
 * Christian is authoring bespoke replacement art in parallel; dropping an SVG
 * over the same filename swaps it in with no code change. Forms without an asset
 * (flat-dorsoventral, no-shell) show a neutral placeholder.
 */

import { useState } from "react";
import { TileGate, MaskSilhouette, type TileSpec } from "@/components/idflow/TileGate";
import { BodyFormExamples } from "@/components/idflow/BodyFormExamples";
import { bodyFormConfigFor, type BodyFormOption } from "@/lib/idflow/body-forms";
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
}: {
  shapeClass: ShapeClass;
  /** Pick a body form (value) or skip it (null). The trait key is passed back
   * so FeedCard can seed the strip's narrowing without re-deriving it. */
  onSelectForm: (key: TraitKey, value: string | null) => void;
  /** "Skip to guess" — jump to the MCQ fallback. */
  onSkip: () => void;
  onClose: () => void;
}) {
  const [examplesFor, setExamplesFor] = useState<BodyFormOption | null>(null);
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
    extra: (
      <button
        type="button"
        onClick={() => setExamplesFor(o)}
        aria-label={`See example photos of ${o.label}`}
        className="inline-flex min-h-[32px] items-center justify-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/60 transition-colors hover:border-teal-400 hover:bg-teal-500/15 hover:text-teal-200"
      >
        <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <rect x="1.5" y="2.5" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="5" cy="6" r="1.1" fill="currentColor" />
          <path d="M2.5 11l3-3 2.5 2 2-1.5 1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Examples
      </button>
    ),
  }));

  return (
    <>
      <TileGate
        ariaLabel={config.prompt}
        title={config.prompt}
        tiles={tiles}
        columns={Math.min(config.options.length, 4)}
        onSelect={(value) => onSelectForm(config.key, value)}
        onClose={onClose}
        notSure={{ label: "Not sure", onClick: () => onSelectForm(config.key, null) }}
        skip={{ label: "Skip to guess", onClick: onSkip }}
        suspendKeyboard={!!examplesFor}
      />
      {examplesFor && (
        <BodyFormExamples
          shapeClass={shapeClass}
          formKey={config.key}
          formValue={examplesFor.value}
          formLabel={examplesFor.label}
          onClose={() => setExamplesFor(null)}
        />
      )}
    </>
  );
}
