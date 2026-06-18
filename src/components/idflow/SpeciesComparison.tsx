"use client";

/**
 * Side-by-side "tell them apart" comparison (18 Jun 2026), opened from the
 * Rung-3 candidate gate when the remaining species are genuine look-alikes
 * (currently the three right-eyed flatfish). It lines the look-alikes up next to
 * each other with the ONE cue that separates each, drawn from the UK ID guides
 * (see src/lib/idflow/comparisons.ts for sources), plus a quickest-route tip and
 * a hybrid caveat. Tapping a species commits it as the guess.
 *
 * Focus management is inline (no nested lightbox here, unlike SpeciesGuidePopup),
 * following the same WCAG contract: focus in, scroll lock, Escape, Tab trap,
 * focus restore. Colour is never the only link between a cue and a photo: each
 * card carries its own photo + name + cues together (the owner is colour-blind).
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ComparisonGroup } from "@/lib/idflow/comparisons";

export function SpeciesComparison({
  group,
  submitting,
  onPick,
  onClose,
}: {
  group: ComparisonGroup;
  submitting: boolean;
  /** Commit a species (by common name) as the guess. */
  onPick: (commonName: string) => void;
  /** Dismiss without committing (back to the grid). */
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Lead photo per member, fetched once (same route the candidate grid uses).
  const [photos, setPhotos] = useState<Record<string, string | null>>({});
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      group.members.map((m) =>
        fetch(`/api/species-images/${encodeURIComponent(m.scientificName)}?limit=1`)
          .then((r) => (r.ok ? r.json() : null))
          .then(
            (d) =>
              [
                m.scientificName,
                d?.images?.[0]?.url ?? d?.images?.[0]?.thumbUrl ?? null,
              ] as const,
          )
          .catch(() => [m.scientificName, null] as const),
      ),
    ).then((entries) => {
      if (!cancelled) setPhotos(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [group]);

  // Focus in, scroll lock, Escape + Tab trap, focus restore.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog
      ?.querySelector<HTMLElement>("button:not([disabled]), [tabindex]:not([tabindex='-1'])")
      ?.focus({ preventScroll: true });
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const f = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
      opener?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={group.title}
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-card bg-navy-900 text-white shadow-menu sm:rounded-card"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-h3 font-semibold leading-tight text-white">{group.title}</h2>
            <p className="mt-1 text-[11px] leading-snug text-white/60">{group.intro}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to the list"
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/80 hover:bg-white/20 hover:text-white"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3.5L5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
          <p className="text-center text-[11px] font-medium text-teal-200/90">
            Compare them, then tap the one that matches your clip.
          </p>

          {/* Side by side: one column per look-alike, each self-contained
              (photo + name + its killer cue + supporting cue), tappable to pick. */}
          <div className="grid grid-cols-3 gap-2">
            {group.members.map((m) => {
              const photo = photos[m.scientificName];
              return (
                <button
                  key={m.scientificName}
                  type="button"
                  disabled={submitting}
                  onClick={() => onPick(m.commonName)}
                  aria-label={`This is the one: ${m.commonName}`}
                  className="group flex flex-col overflow-hidden rounded-modal border border-white/15 bg-white/5 text-left transition-colors hover:border-teal-400 hover:bg-teal-500/15 focus-visible:border-teal-400 disabled:opacity-60"
                >
                  <span className="block aspect-square w-full overflow-hidden bg-black/40">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt={m.commonName} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-white/20">
                        <svg viewBox="0 0 48 32" fill="none" aria-hidden="true" className="w-1/2">
                          <path d="M6 16c3-7 9-11 16-11 9 0 16 5 19 11-3 6-10 11-19 11-7 0-13-4-16-11z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                          <path d="M41 16l6-5v10l-6-5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                  </span>
                  <span className="flex flex-1 flex-col gap-1 p-2">
                    <span className="text-[12px] font-semibold leading-tight text-white">{m.commonName}</span>
                    <span className="text-[11px] font-medium leading-snug text-teal-100">{m.headline}</span>
                    <span className="text-[10px] leading-snug text-white/55">{m.also}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quickest decision route across the whole group. */}
          <div className="rounded-modal border border-teal-500/25 bg-teal-500/10 p-3">
            <p className="mb-1 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-teal-300/90">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 1.5l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.3 4.2 13.3l.7-4.3-3.1-3 4.3-.6z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              </svg>
              Quickest check
            </p>
            <p className="text-[12px] leading-relaxed text-white/85">{group.tip}</p>
          </div>

          {group.caveat && (
            <p className="text-[11px] leading-snug text-white/50">
              <span className="font-semibold text-white/70">Watch out: </span>
              {group.caveat}
            </p>
          )}

          {group.sources.length > 0 && (
            <p className="text-[10px] leading-snug text-white/40">
              Sources:{" "}
              {group.sources.map((s, i) => (
                <span key={s.label}>
                  {i > 0 && ", "}
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-white/30 underline-offset-2 hover:text-white/70"
                    >
                      {s.label}
                    </a>
                  ) : (
                    s.label
                  )}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
