"use client";

/**
 * "Examples" popup for a Rung-2 body-form tile (3 Jun).
 *
 * A focus-trapped, portaled dark modal listing the catalogue species that have
 * the chosen body form, each with its CC-attributed photo strip (reusing the
 * battle-tested SpeciesGallery). Purely a teaching aid: tapping a photo opens
 * SpeciesGallery's own lightbox; nothing here commits a guess.
 *
 * Renders ABOVE the BodyShapeGate (z-60). The gate is told to suspend its
 * keyboard handling while this is open (see BodyShapeGate), so Escape and the
 * focus trap belong solely to this popup.
 */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { exampleSpeciesForForm } from "@/lib/idflow/body-forms";
import { SpeciesGallery } from "@/components/SpeciesGallery";
import type { ShapeClass } from "@/lib/idguide/traits";
import type { TraitKey } from "@/lib/idguide/narrow";

export function BodyFormExamples({
  shapeClass,
  formKey,
  formValue,
  formLabel,
  onClose,
}: {
  shapeClass: ShapeClass;
  formKey: TraitKey;
  formValue: string;
  formLabel: string;
  onClose: () => void;
}) {
  const species = exampleSpeciesForForm(shapeClass, formKey, formValue);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const lastFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel
      ?.querySelector<HTMLElement>(
        "button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])",
      )
      ?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const f = panel.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])",
      );
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      lastFocused?.focus?.();
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3">
      <button
        type="button"
        aria-label="Close examples"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/70"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Examples: ${formLabel}`}
        className="relative z-10 flex max-h-[85vh] w-[min(40rem,calc(100%-1rem))] flex-col overflow-hidden rounded-card border border-white/12 bg-navy-900/97 shadow-menu backdrop-blur"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-teal-300/90">
              Examples
            </p>
            <p className="mt-0.5 text-sm font-semibold text-white">{formLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close examples"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-white/10 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/80 hover:bg-white/20 hover:text-white"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Close
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-3">
          {species.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/60">
              No example photos cached yet for this body type.
            </p>
          ) : (
            <>
              <p className="mb-3 text-[11px] leading-snug text-white/55">
                Species with this body type. These are reference photos to compare
                against, not the answer.
              </p>
              <ul className="flex flex-col gap-4">
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
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
