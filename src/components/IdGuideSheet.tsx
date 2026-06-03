"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import speciesTraitsData from "@/data/species-traits.json";
import type { SpeciesCatalogue, TraitSelection } from "@/lib/idguide/traits";
import { IdGuideChat } from "./IdGuideChat";
import { IdGuideChipFallback } from "./IdGuideChipFallback";
import { IdGuideWizard } from "./IdGuideWizard";
import { SpeciesGallery } from "./SpeciesGallery";

const CATALOGUE = speciesTraitsData as unknown as SpeciesCatalogue;

type Mode = "wizard" | "chat" | "chips" | "fieldNote";

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
  // Wizard is now the default entry: it works for everyone (no API needed)
  // and gives first-time users a clear funnel before chat/chips come in.
  const initialMode: Mode = fieldNoteFor ? "fieldNote" : "wizard";
  const [mode, setMode] = useState<Mode>(initialMode);
  // Lift chip selection so switching chat ↔ chips doesn't reset it.
  const [chipSelection, setChipSelection] = useState<TraitSelection>({});
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    if (!open) return;
    setMode(fieldNoteFor ? "fieldNote" : "wizard");
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
    return () => {
      lastFocusedRef.current?.focus?.();
    };
  }, [open]);

  // Move focus into the first focusable on open AND whenever the active mode
  // changes — otherwise focus would stay on the previous mode's element
  // after a chat → chips switch.
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = dialog.querySelector<HTMLElement>(
      "input, textarea, button:not([disabled]), [tabindex]:not([tabindex='-1'])",
    );
    focusable?.focus();
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Q3A-T2: H is the "minimize / peek at video" shortcut. Same input
      // guard as the FeedCard handler so typing "h" in the chat textarea
      // doesn't close the sheet.
      if (e.key === "h" || e.key === "H") {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
          return;
        }
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Q4-A-6: Tab focus-trap. Without this, keyboard users tabbing
      // through the sheet eventually walk into the video + MCQ buttons
      // underneath — which is a WCAG 2.1.2 failure (no keyboard trap on
      // modal dialogs). Mirrors the trap pattern in SideMenu.tsx:103-118.
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Q3A-T2: flag the open state on document.body so the feed-level H
    // handler in FeedCard can skip firing while the sheet is open
    // (otherwise both handlers run on the same window event and the
    // candidate panel would toggle every time the user closes the sheet
    // with H).
    document.body.dataset.idGuideOpen = "1";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      delete document.body.dataset.idGuideOpen;
    };
  }, [open, onClose]);

  const fieldNote = useMemo(() => {
    if (!fieldNoteFor) return null;
    const sci = fieldNoteFor.scientificName;
    if (sci && CATALOGUE[sci]) return { ...CATALOGUE[sci], scientificName: sci };
    const normalise = (s: string) =>
      s.toLowerCase().replace(/\([^)]*\)/g, "").replace(/[^a-z0-9]+/g, "");
    const tokenSort = (s: string) =>
      s.toLowerCase().replace(/\([^)]*\)/g, "").split(/[^a-z0-9]+/).filter(Boolean).sort().join("");
    const stripPlural = (s: string) => (s.endsWith("s") && s.length > 3 ? s.slice(0, -1) : s);

    const target = normalise(fieldNoteFor.commonName);
    // scientific-name match against catalogue key
    for (const k of Object.keys(CATALOGUE)) {
      if (normalise(k) === target) return { ...CATALOGUE[k], scientificName: k };
    }
    // exact normalised commonName
    let match = Object.entries(CATALOGUE).find(([, t]) => normalise(t.commonName) === target);
    if (!match) {
      const singular = stripPlural(target);
      match = Object.entries(CATALOGUE).find(([, t]) => stripPlural(normalise(t.commonName)) === singular);
    }
    if (!match) {
      const sortedTarget = tokenSort(fieldNoteFor.commonName);
      match = Object.entries(CATALOGUE).find(([, t]) => tokenSort(t.commonName) === sortedTarget);
    }
    if (!match) return null;
    return { ...match[1], scientificName: match[0] };
  }, [fieldNoteFor]);

  // Lifted up so the fieldNote dead-end can switch the user to any catalogue
  // species. The selectedFallback overrides fieldNoteFor while the sheet is
  // open, without losing the original query for the title.
  const [selectedFallback, setSelectedFallback] = useState<string | null>(null);
  const effectiveFieldNote = useMemo(() => {
    if (selectedFallback && CATALOGUE[selectedFallback]) {
      return { ...CATALOGUE[selectedFallback], scientificName: selectedFallback };
    }
    return fieldNote;
  }, [fieldNote, selectedFallback]);

  useEffect(() => {
    setSelectedFallback(null);
  }, [open, fieldNoteFor]);

  if (!open) return null;

  const title =
    mode === "fieldNote"
      ? `How to spot a ${fieldNoteFor?.commonName ?? ""}`
      : mode === "chips"
        ? "Identification — all traits"
        : mode === "chat"
          ? "Identification — ask the biologist"
          : "Identification — guided";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      {/* S7-T3: the field-note / wizard / chat content is the user's main
           tool for picking the right species — give it room. Desktop
           expands to 96vw (capped at max-w-7xl / 1280px so paragraph line
           lengths stay readable on ultrawide). Mobile stays a
           bottom-anchored full-height sheet. */}
      <div
        ref={dialogRef}
        className="relative flex h-[96dvh] w-full max-w-7xl flex-col overflow-hidden bg-navy-800 shadow-menu sm:h-[94vh] sm:w-[96vw] sm:rounded-modal"
        style={{
          transform: keyboardOffset > 0 ? `translateY(-${keyboardOffset}px)` : undefined,
          transition: "transform 120ms ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-eyebrow text-teal-50">
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

        {mode === "wizard" && (
          <div className="flex min-h-0 flex-1 flex-col">
            <IdGuideWizard
              onPick={(name) => {
                onAnswerPicked(name);
                onClose();
              }}
              onSwitchToChat={isLoggedIn ? () => setMode("chat") : undefined}
              onSwitchToChips={() => setMode("chips")}
            />
          </div>
        )}

        {mode === "chat" && (
          <div className="flex min-h-0 flex-1 flex-col">
            <IdGuideChat
              snippetId={snippetId}
              onPickCandidate={(name) => {
                onAnswerPicked(name);
                onClose();
              }}
              onFallback={() => setMode("chips")}
            />
          </div>
        )}

        {mode === "chips" && (
          <div className="flex min-h-0 flex-1 flex-col">
            <IdGuideChipFallback
              selected={chipSelection}
              onSelectionChange={setChipSelection}
              onPickCandidate={(name) => {
                onAnswerPicked(name);
                onClose();
              }}
              onBackToChat={() => setMode("wizard")}
            />
          </div>
        )}

        {mode === "fieldNote" && (
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-8 sm:py-6 [scrollbar-gutter:stable]">
            {effectiveFieldNote ? (
              <>
                {selectedFallback && fieldNoteFor && (
                  <button
                    type="button"
                    onClick={() => setSelectedFallback(null)}
                    className="mb-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/55 hover:text-white/85"
                  >
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M9.5 6h-6M6 3L3 6l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Back to “{fieldNoteFor.commonName}”
                  </button>
                )}
                <p className="pb-1 text-[11px] font-semibold uppercase tracking-wider text-teal-500">
                  {effectiveFieldNote.commonName}
                </p>
                <p className="pb-3 text-[12px] italic text-white/55">
                  {effectiveFieldNote.scientificName}
                </p>
                {/* S7-T3: two-column layout on desktop so the extra
                     width is actually used — gallery left, prose +
                     traits right. Mobile stacks naturally. */}
                <div className="grid gap-6 sm:grid-cols-[minmax(0,460px)_1fr] sm:gap-8">
                  <div>
                    <SpeciesGallery
                      scientificName={effectiveFieldNote.scientificName}
                      commonName={effectiveFieldNote.commonName}
                      size="large"
                    />
                  </div>
                  <div className="max-w-prose space-y-4">
                    <p className="text-sm leading-relaxed text-white/85">
                      {effectiveFieldNote.fieldNote}
                    </p>
                    <div className="space-y-2 text-[12px] text-white/75">
                      <TraitRow label="Body shape" values={effectiveFieldNote.bodyShape} />
                      <TraitRow label="Size" values={[effectiveFieldNote.size]} />
                      <TraitRow label="Colour" values={effectiveFieldNote.coloration} />
                      <TraitRow label="Markings" values={effectiveFieldNote.markings.filter((m) => m !== "none")} />
                      <TraitRow label="Fins" values={effectiveFieldNote.finShape} />
                      <TraitRow label="Features" values={effectiveFieldNote.features.filter((f) => f !== "none")} />
                      <TraitRow label="Behaviour" values={effectiveFieldNote.behavior} />
                      <TraitRow label="Habitat" values={effectiveFieldNote.habitat} />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <CatalogueBrowser
                staffAnswer={fieldNoteFor?.commonName ?? null}
                onPick={(sci) => setSelectedFallback(sci)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CatalogueBrowser({
  staffAnswer,
  onPick,
}: {
  staffAnswer: string | null;
  onPick: (scientificName: string) => void;
}) {
  const [query, setQuery] = useState("");
  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = Object.entries(CATALOGUE).map(([sci, t]) => ({
      sci,
      commonName: t.commonName,
      fieldNote: t.fieldNote,
    }));
    all.sort((a, b) => a.commonName.localeCompare(b.commonName));
    if (!q) return all;
    return all.filter(
      (e) =>
        e.commonName.toLowerCase().includes(q) ||
        e.sci.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div>
      <p className="pb-1 text-[11px] font-semibold uppercase tracking-wider text-amber-200">
        Field notes for “{staffAnswer ?? "this species"}” aren&apos;t in the catalogue yet
      </p>
      <p className="pb-3 text-[12px] text-white/65">
        Browse the species the biologist tracks on the Welsh coast — pick one
        to see how to spot it.
      </p>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by common or scientific name…"
        aria-label="Search species by common or scientific name"
        className="mb-2 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-teal-500 focus:outline-none"
      />
      {entries.length === 0 ? (
        <p className="py-2 text-sm text-white/45">No matches.</p>
      ) : (
        <div className="space-y-1.5">
          {entries.map((e) => (
            <button
              key={e.sci}
              type="button"
              onClick={() => onPick(e.sci)}
              className="block w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-[12px] hover:border-teal-500/60 hover:bg-white/10"
            >
              <div className="text-white/90">{e.commonName}</div>
              <div className="text-[10px] italic text-white/45">{e.sci}</div>
            </button>
          ))}
        </div>
      )}
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
