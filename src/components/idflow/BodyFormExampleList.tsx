"use client";

/**
 * Inline examples list for a Rung-2 body-form row (3 Jun, replaces the earlier
 * portaled BodyFormExamples popup).
 *
 * Lists the catalogue species that have the chosen body form, each with its
 * CC-attributed photo strip (reusing SpeciesGallery). Purely a teaching aid:
 * tapping a photo opens SpeciesGallery's own lightbox; nothing here commits a
 * guess. Rendered inside the TileGate "list" accordion, so it carries no chrome
 * of its own (no portal, backdrop or focus trap) — the gate owns those, and the
 * chevron that mounts it owns the collapse.
 */

import { exampleSpeciesForForm } from "@/lib/idflow/body-forms";
import { SpeciesGallery } from "@/components/SpeciesGallery";
import type { ShapeClass } from "@/lib/idguide/traits";
import type { TraitKey } from "@/lib/idguide/narrow";

export function BodyFormExampleList({
  shapeClass,
  formKey,
  formValue,
}: {
  shapeClass: ShapeClass;
  formKey: TraitKey;
  formValue: string;
}) {
  const species = exampleSpeciesForForm(shapeClass, formKey, formValue);

  if (species.length === 0) {
    return (
      <p className="py-2 text-center text-sm text-white/60">
        No example photos cached yet for this body type.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2.5 text-[11px] leading-snug text-white/55">
        Species with this body type. Reference photos to compare against, not the
        answer.
      </p>
      <ul className="flex flex-col gap-3.5">
        {species.map((s) => (
          <li key={s.scientificName}>
            <p className="mb-1 text-sm font-medium text-white">
              {s.commonName}{" "}
              <span className="text-[11px] font-normal italic text-white/50">
                {s.scientificName}
              </span>
            </p>
            <SpeciesGallery
              scientificName={s.scientificName}
              commonName={s.commonName}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
