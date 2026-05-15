"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import speciesTraitsData from "@/data/species-traits.json";
import type { SpeciesCatalogue, TraitSelection } from "@/lib/idguide/traits";
import { IdGuideChat } from "./IdGuideChat";
import { IdGuideChipFallback } from "./IdGuideChipFallback";

const CATALOGUE = speciesTraitsData as unknown as SpeciesCatalogue;

type Mode = "chat" | "chips" | "fieldNote";

export function IdGuideSheet({
  open,
  onClose,
  snippetId,
  onAnswerPicked,
  fieldNoteFor,
  isLoggedIn,
}: {
  open: boolean;
  onClose: () => void;
  snippetId: string;
  onAnswerPicked: (commonName: string) => void;
  /** When set, sheet opens in read-only field-note mode for the given staff answer (scientific or common name). */
  fieldNoteFor?: { commonName: string; scientificName?: string };
  isLoggedIn: boolean;
}) {
  const initialMode: Mode = fieldNoteFor ? "fieldNote" : isLoggedIn ? "chat" : "chips";
  const [mode, setMode] = useState<Mode>(initialMode);
  // Lift chip selection so switching chat ↔ chips doesn't reset it.
  const [chipSelection, setChipSelection] = useState<TraitSelection>({});
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    if (!open) return;
    setMode(fieldNoteFor ? "fieldNote" : isLoggedIn ? "chat" : "chips");
  }, [open, fieldNoteFor, isLoggedIn]);

  // Track visualViewport so the sheet rises above the mobile keyboard.
  useEffect(() => {
    if (!open || typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const onResize = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(offset);
    };
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    onResize();
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, [open]);

  // Focus management: remember what had focus, move into the dialog on open,
  // restore on close.
  useEffect(() => {
    if (!open) return;
    lastFocusedRef.current = (document.activeElement as HTMLElement) ?? null;
    const dialog = dialogRef.current;
    if (dialog) {
      const focusable = dialog.querySelector<HTMLElement>(
        "input, textarea, button:not([disabled]), [tabindex]:not([tabindex='-1'])",
      );
      focusable?.focus();
    }
    return () => {
      lastFocusedRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const fieldNote = useMemo(() => {
    if (!fieldNoteFor) return null;
    const sci = fieldNoteFor.scientificName;
    if (sci && CATALOGUE[sci]) return { ...CATALOGUE[sci], scientificName: sci };
    const match = Object.entries(CATALOGUE).find(
      ([, t]) => t.commonName.toLowerCase() === fieldNoteFor.commonName.toLowerCase(),
    );
    if (!match) return null;
    return { ...match[1], scientificName: match[0] };
  }, [fieldNoteFor]);

  if (!open) return null;

  const title =
    mode === "fieldNote"
      ? `How to spot a ${fieldNoteFor?.commonName ?? ""}`
      : mode === "chips"
        ? "Identification — manual filter"
        : "Identification — ask the biologist";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="relative flex h-[80vh] w-full max-w-lg flex-col overflow-hidden bg-[#0f1d22] shadow-2xl sm:h-[70vh] sm:rounded-2xl"
        style={{
          transform: keyboardOffset > 0 ? `translateY(-${keyboardOffset}px)` : undefined,
          transition: "transform 120ms ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-[#DEF2F1]">
              {title}
            </p>
            {mode !== "fieldNote" && (
              <p className="truncate text-[10px] text-white/45">
                You always pick your own answer.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/85 hover:bg-white/20"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {mode === "chat" && (
          <IdGuideChat
            snippetId={snippetId}
            onPickCandidate={(name) => {
              onAnswerPicked(name);
              onClose();
            }}
            onFallback={() => setMode("chips")}
          />
        )}

        {mode === "chips" && (
          <IdGuideChipFallback
            selected={chipSelection}
            onSelectionChange={setChipSelection}
            onPickCandidate={(name) => {
              onAnswerPicked(name);
              onClose();
            }}
            onBackToChat={isLoggedIn ? () => setMode("chat") : undefined}
          />
        )}

        {mode === "fieldNote" && (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {fieldNote ? (
              <>
                <p className="pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#3AAFA9]">
                  {fieldNote.commonName}
                </p>
                <p className="pb-3 text-[12px] italic text-white/55">
                  {fieldNote.scientificName}
                </p>
                <p className="pb-4 text-sm leading-relaxed text-white/85">{fieldNote.fieldNote}</p>
                <div className="space-y-2 text-[12px] text-white/75">
                  <TraitRow label="Body shape" values={fieldNote.bodyShape} />
                  <TraitRow label="Size" values={[fieldNote.size]} />
                  <TraitRow label="Colour" values={fieldNote.coloration} />
                  <TraitRow label="Markings" values={fieldNote.markings.filter((m) => m !== "none")} />
                  <TraitRow label="Fins" values={fieldNote.finShape} />
                  <TraitRow label="Features" values={fieldNote.features.filter((f) => f !== "none")} />
                  <TraitRow label="Behaviour" values={fieldNote.behavior} />
                  <TraitRow label="Habitat" values={fieldNote.habitat} />
                </div>
              </>
            ) : (
              <p className="text-sm text-white/55">No field notes yet for this species.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TraitRow({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="flex flex-wrap items-baseline gap-1.5">
      <span className="w-[68px] shrink-0 text-[10px] uppercase tracking-wider text-white/45">{label}</span>
      <span className="flex flex-wrap gap-1">
        {values.map((v) => (
          <span key={v} className="rounded-full bg-white/8 px-2 py-0.5 text-[11px]">
            {v.replace(/-/g, " ")}
          </span>
        ))}
      </span>
    </div>
  );
}
