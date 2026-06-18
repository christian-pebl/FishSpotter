"use client";

/**
 * Side-by-side "tell them apart" comparison, opened from the candidate gate when
 * the remaining species are genuine look-alikes. Deliberately spare (18 Jun
 * 2026): a row of LARGE photo cards, one per look-alike, each carrying only the
 * fish name + a couple of bullet points of distinctive features. No intro, tip,
 * caveat or sources clutter the view (those still live in comparisons.ts for the
 * record). Tapping a card commits that species as the guess.
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
  probabilityByScientific,
  onPick,
  onClose,
}: {
  group: ComparisonGroup;
  submitting: boolean;
  /** Per-species ecological likelihood for THIS clip's location/depth/month
   * bucket (OBIS, via /api/snippets/[id]/probability). Values are a 0..1 share
   * of local records. Omitted / all-zero when the bucket has no data — the
   * likelihood UI then hides itself. */
  probabilityByScientific?: Record<string, number>;
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

  // Local likelihood (OBIS share of records in this clip's bucket). When we have
  // data, sort the cards most-likely-here first so the eye lands on the strongest
  // candidate; when we don't, keep the authored order and hide the likelihood UI.
  const prob = probabilityByScientific ?? {};
  const maxProb = Math.max(0, ...group.members.map((m) => prob[m.scientificName] ?? 0));
  const hasProb = maxProb > 0;
  const orderedMembers = hasProb
    ? [...group.members].sort(
        (a, b) => (prob[b.scientificName] ?? 0) - (prob[a.scientificName] ?? 0),
      )
    : group.members;

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
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <h2 className="min-w-0 text-h3 font-semibold leading-tight text-white">{group.title}</h2>
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

        <div className="flex-1 overflow-y-auto p-3">
          {/* Ecological-likelihood hint: how often each look-alike is recorded
              around this clip's spot at this time of year (OBIS). A prior, framed
              honestly so it never overrides what the user actually saw. */}
          {hasProb && (
            <p className="mb-3 rounded-modal border border-teal-500/20 bg-teal-500/5 px-3 py-2 text-[10px] leading-snug text-white/55">
              <span className="font-semibold text-teal-200/90">Local likelihood</span> — how
              often each turns up around here at this time of year (OBIS records). A hint
              from the data; trust what you actually saw in the clip.
            </p>
          )}
          {/* Big photo cards, one per look-alike: image + name + a couple of
              distinctive-feature bullets, nothing else. Fixed wide cards keep the
              photos large; the row scrolls (swipe) to compare the rest. Tapping a
              card commits that species. */}
          <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15">
            {orderedMembers.map((m) => {
              const photo = photos[m.scientificName];
              return (
                <button
                  key={m.scientificName}
                  type="button"
                  disabled={submitting}
                  onClick={() => onPick(m.commonName)}
                  aria-label={`This is the one: ${m.commonName}`}
                  className="group flex w-[min(20rem,82vw)] shrink-0 snap-start flex-col overflow-hidden rounded-card border border-white/15 bg-white/5 text-left transition-colors hover:border-teal-400 hover:bg-teal-500/15 focus-visible:border-teal-400 disabled:opacity-60"
                >
                  <span className="block aspect-[4/3] w-full overflow-hidden bg-black/40">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt={m.commonName} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-white/20">
                        <svg viewBox="0 0 48 32" fill="none" aria-hidden="true" className="w-1/3">
                          <path d="M6 16c3-7 9-11 16-11 9 0 16 5 19 11-3 6-10 11-19 11-7 0-13-4-16-11z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                          <path d="M41 16l6-5v10l-6-5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                  </span>
                  <span className="flex flex-col gap-2 p-3">
                    <span className="text-sm font-semibold leading-tight text-white">{m.commonName}</span>
                    <ul className="flex flex-col gap-1.5">
                      {[m.headline, m.also].map((point, i) => (
                        <li key={i} className="flex gap-2 text-[12px] leading-snug text-white/85">
                          <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-teal-400" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                    {hasProb &&
                      (() => {
                        const p = prob[m.scientificName] ?? 0;
                        const ratio = maxProb > 0 ? p / maxProb : 0;
                        const isTop = p > 0 && p === maxProb;
                        const pct = p <= 0 ? null : p * 100 < 1 ? "<1%" : `${Math.round(p * 100)}%`;
                        return (
                          <span className="mt-1 flex flex-col gap-1 border-t border-white/10 pt-2">
                            <span className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider">
                              <span className={isTop ? "text-teal-300" : p > 0 ? "text-white/70" : "text-white/40"}>
                                {isTop ? "Most likely here" : p > 0 ? "Seen here" : "Not recorded here"}
                              </span>
                              {pct && (
                                <span className="font-normal tracking-normal text-white/45">{pct} of records</span>
                              )}
                            </span>
                            <span className="block h-1.5 w-full overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                              <span
                                className={`block h-full rounded-full ${isTop ? "bg-teal-400" : "bg-teal-500/55"}`}
                                style={{ width: `${p > 0 ? Math.max(8, Math.round(ratio * 100)) : 0}%` }}
                              />
                            </span>
                          </span>
                        );
                      })()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
