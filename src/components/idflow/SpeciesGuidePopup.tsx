"use client";

/**
 * Species guide popup, the "flash card" a user sees when they tap a species
 * tile in the live ID flow (Rung 3 CandidateGate). It renders the SHARED
 * SpeciesGuideContent (the exact same detail shown on the /species/[slug]
 * profile page reached from the menu), so the two never drift apart. The ONLY
 * difference here is the "This is my pick" button that commits the guess.
 *
 * Focus management is inline rather than via useModalFocus because SpeciesGallery
 * opens its OWN lightbox (portaled to body at z-[100], above this popup at
 * z-[90]). We must NOT let an Escape that closes the lightbox also close this
 * popup, so the Escape handler bails while a lightbox dialog is on screen.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { PanelOverlay } from "@/components/idflow/PanelOverlay";
import { SpeciesGuideContent } from "@/components/species/SpeciesGuideContent";
import { CATALOGUE } from "@/lib/idguide/catalogue";

// SpeciesGallery's lightbox renders role="dialog" with an aria-label that
// starts with "Photo of". If one is open, this popup must ignore Escape so a
// single keypress doesn't close both.
function lightboxIsOpen(): boolean {
  if (typeof document === "undefined") return false;
  return !!document.querySelector('[role="dialog"][aria-label^="Photo of"]');
}

export function SpeciesGuidePopup({
  scientificName,
  commonName,
  submitting,
  onConfirm,
  onRuleOut,
  onClose,
}: {
  scientificName: string;
  commonName: string;
  submitting: boolean;
  /** Commit this species as the user's guess. */
  onConfirm: () => void;
  /** Eliminate this species and return to the grid. This is the moment a real
   *  identification rules something out: the user has just opened the species
   *  and read its diagnostic marks. Making them close the popup and then hunt
   *  for the tile's corner control would waste that. Omit to hide the action. */
  onRuleOut?: () => void;
  /** Dismiss without committing (back to the list). */
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const traits = CATALOGUE[scientificName];

  // Focus in, scroll lock, guarded Escape + Tab trap.
  const close = useCallback(() => {
    if (lightboxIsOpen()) return; // the lightbox owns this Escape
    onClose();
  }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog
      ?.querySelector<HTMLElement>("button:not([disabled]), [tabindex]:not([tabindex='-1'])")
      ?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      if (lightboxIsOpen()) return; // lightbox runs its own trap
      const root = dialogRef.current;
      if (!root) return;
      const f = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled])',
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
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [close]);

  if (!mounted || typeof document === "undefined") return null;

  return (
    <PanelOverlay
      dialogRef={dialogRef}
      ariaLabel={`About ${commonName}`}
      onDismiss={close}
      surfaceClassName="bg-surface text-navy-900"
    >
        <div className="flex items-start justify-between gap-3 border-b border-navy-900/10 px-4 py-3">
          <div className="min-w-0">
            {traits && (
              <p className="text-[10px] font-semibold uppercase tracking-eyebrow text-teal-600">
                {traits.shapeClass.replace(/-/g, " ")}
              </p>
            )}
            <h2 className="font-brand-heading text-h3 leading-tight text-navy-900">{commonName}</h2>
            <p className="truncate text-[11px] italic text-navy-900/55">{scientificName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to the list"
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full bg-surface-muted px-3 text-[11px] font-semibold uppercase tracking-wider text-navy-900/70 hover:bg-teal-500/15 hover:text-teal-700"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3.5L5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
        </div>

        {/* min-h-0 lets this flex child shrink and own the scroll instead of
            overflowing the dialog (mobile "can't scroll" guard). */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-surface-muted/40 px-4 py-4">
          {traits ? (
            <SpeciesGuideContent
              scientificName={scientificName}
              commonName={commonName}
              fieldNote={traits.fieldNote}
            />
          ) : (
            <p className="text-sm text-navy-900/70">No guide available for this species yet.</p>
          )}
        </div>

        <div className="border-t border-navy-900/10 px-4 py-3">
          <button
            type="button"
            disabled={submitting}
            onClick={onConfirm}
            className="pebl-button-primary w-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? "Saving…" : `This is my pick: ${commonName}`}
          </button>
          {onRuleOut && (
            <button
              type="button"
              disabled={submitting}
              onClick={onRuleOut}
              className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full border border-navy-900/15 px-4 text-sm font-semibold text-muted transition-colors hover:border-navy-900/30 hover:text-navy-900 disabled:opacity-60"
            >
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-4 w-4 shrink-0">
                <path
                  d="M2.2 8S4.4 4.4 8 4.4 13.8 8 13.8 8s-2.2 3.6-5.8 3.6S2.2 8 2.2 8Z"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinejoin="round"
                />
                <circle cx="8" cy="8" r="1.7" stroke="currentColor" strokeWidth="1.3" />
                <path d="M3.2 12.8 12.8 3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              Not this one, rule it out
            </button>
          )}
        </div>
    </PanelOverlay>
  );
}
