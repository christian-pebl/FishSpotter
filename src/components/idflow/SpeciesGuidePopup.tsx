"use client";

/**
 * Species guide popup (3 Jun 2026) — the "flash card" a user sees when they
 * tap a species tile in the live ID flow (Rung 3 CandidateGate). Instead of
 * committing the guess instantly, the tile now opens this preview so the user
 * can study the species and confirm.
 *
 * It surfaces, in one place, the three things we author per species:
 *   1. the diagnostic guide — AnnotatedSpeciesPhoto's numbered circles on the
 *      curated reference photo (renders nothing if the species has no marks),
 *   2. a gallery of good-quality CC photos (SpeciesGallery, large + lightbox),
 *   3. the field note prose from the trait catalogue.
 * Plus a "This is my pick" button that commits the guess, and a way back to the
 * list. Nothing here changes the answer until the user confirms.
 *
 * Focus management is inline rather than via useModalFocus because SpeciesGallery
 * opens its OWN lightbox (portaled to body at z-[100], above this popup at
 * z-[90]). We must NOT let an Escape that closes the lightbox also close this
 * popup, so the Escape handler bails while a lightbox dialog is on screen.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnnotatedSpeciesPhoto } from "@/components/AnnotatedSpeciesPhoto";
import { SpeciesGallery } from "@/components/SpeciesGallery";
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
  onClose,
}: {
  scientificName: string;
  commonName: string;
  submitting: boolean;
  /** Commit this species as the user's guess. */
  onConfirm: () => void;
  /** Dismiss without committing (back to the list). */
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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

  const fieldNote = CATALOGUE[scientificName]?.fieldNote;

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`About ${commonName}`}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-card bg-navy-900 text-white shadow-menu sm:rounded-card"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-h3 font-semibold leading-tight text-white">{commonName}</h2>
            <p className="truncate text-[11px] italic text-white/50">{scientificName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to the list"
            className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/80 hover:bg-white/20 hover:text-white"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3.5L5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
          {/* Diagnostic guide (numbered circles). Renders nothing if the
              species has no authored marks on a curated photo. */}
          <AnnotatedSpeciesPhoto scientificName={scientificName} commonName={commonName} />

          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-teal-300/80">
              Reference photos
            </p>
            <SpeciesGallery
              scientificName={scientificName}
              commonName={commonName}
              size="large"
            />
            <p className="mt-1.5 text-[10px] text-white/40">
              Compare these against the clip. Tap a photo to enlarge.
            </p>
          </div>

          {fieldNote && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-teal-300/80">
                Field note
              </p>
              <p className="text-sm leading-relaxed text-white/80">{fieldNote}</p>
            </div>
          )}
        </div>

        <div className="border-t border-white/10 px-4 py-3">
          <button
            type="button"
            disabled={submitting}
            onClick={onConfirm}
            className="pebl-button-primary w-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? "Saving…" : `This is my pick: ${commonName}`}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 w-full rounded-full px-4 py-2 text-[12px] font-medium text-white/55 hover:text-white"
          >
            Keep looking
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
