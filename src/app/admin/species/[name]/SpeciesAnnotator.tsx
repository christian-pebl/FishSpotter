"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { createMark, deleteMark, swapMarkOrder, updateMark } from "./actions";

export type AnnotatorPhoto = {
  id: string;
  url: string;
  thumbUrl: string | null;
  attribution: string;
  width: number | null;
  height: number | null;
};

export type AnnotatorMark = {
  id: string;
  speciesImageId: string;
  order: number;
  label: string;
  description: string;
  overlayX: number;
  overlayY: number;
  overlayRadius: number;
};

const DEFAULT_RADIUS = 0.06;
const MIN_RADIUS = 0.01;
const MAX_RADIUS = 0.5;

// F-ADMIN-SAVE-FEEDBACK: server-action failures previously only console.error'd
// while the optimistic on-screen state persisted, so a failed save looked
// successful and silently desynced from the DB. We now surface this.
const SAVE_ERROR_MSG =
  "Couldn't save that change. Reload the page to re-sync with the database before continuing.";

type DragState =
  | null
  | { kind: "move"; markId: string; pointerId: number; dxFrac: number; dyFrac: number }
  | { kind: "resize"; markId: string; pointerId: number };

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
function clampRadius(n: number): number {
  return Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, n));
}

export function SpeciesAnnotator({
  scientificName,
  photos,
  initialMarks,
}: {
  scientificName: string;
  photos: AnnotatorPhoto[];
  initialMarks: AnnotatorMark[];
}) {
  const [marks, setMarks] = useState<AnnotatorMark[]>(initialMarks);
  const [photoId, setPhotoId] = useState<string>(
    initialMarks[0]?.speciesImageId ?? photos[0]?.id ?? "",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [isSaving, startSavingTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  const activePhoto = useMemo(
    () => photos.find((p) => p.id === photoId) ?? photos[0],
    [photoId, photos],
  );

  // Marks attached to the currently-visible photo.
  const visibleMarks = useMemo(
    () => marks.filter((m) => m.speciesImageId === photoId).sort((a, b) => a.order - b.order),
    [marks, photoId],
  );

  const selectedMark = useMemo(
    () => visibleMarks.find((m) => m.id === selectedId) ?? null,
    [visibleMarks, selectedId],
  );

  function pointerFraction(e: React.PointerEvent | PointerEvent): { x: number; y: number } | null {
    const wrap = wrapperRef.current;
    if (!wrap) return null;
    const r = wrap.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    return { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) };
  }

  function handlePhotoPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Clicks on circle / handle bubble up but mark their own target — we
    // only treat true empty-space clicks as "create new mark".
    if ((e.target as HTMLElement | SVGElement).dataset?.markhit) return;
    const frac = pointerFraction(e);
    if (!frac) return;
    if (!photoId) return;
    startSavingTransition(async () => {
      setSaveError(null);
      try {
        const created = await createMark({
          scientificName,
          speciesImageId: photoId,
          label: "New mark",
          description: "",
          overlayX: frac.x,
          overlayY: frac.y,
          overlayRadius: DEFAULT_RADIUS,
        });
        setMarks((prev) => [...prev, created]);
        setSelectedId(created.id);
      } catch (err) {
        console.error("createMark failed", err);
        setSaveError(SAVE_ERROR_MSG);
      }
    });
  }

  function startMove(e: React.PointerEvent<SVGElement>, mark: AnnotatorMark) {
    e.stopPropagation();
    const frac = pointerFraction(e);
    if (!frac) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setSelectedId(mark.id);
    setDragState({
      kind: "move",
      markId: mark.id,
      pointerId: e.pointerId,
      dxFrac: frac.x - mark.overlayX,
      dyFrac: frac.y - mark.overlayY,
    });
  }

  function startResize(e: React.PointerEvent<SVGElement>, mark: AnnotatorMark) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setSelectedId(mark.id);
    setDragState({ kind: "resize", markId: mark.id, pointerId: e.pointerId });
  }

  function handleDragMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragState) return;
    const frac = pointerFraction(e);
    if (!frac) return;
    if (dragState.kind === "move") {
      setMarks((prev) =>
        prev.map((m) =>
          m.id === dragState.markId
            ? { ...m, overlayX: clamp01(frac.x - dragState.dxFrac), overlayY: clamp01(frac.y - dragState.dyFrac) }
            : m,
        ),
      );
    } else {
      const mark = marks.find((m) => m.id === dragState.markId);
      if (!mark) return;
      const wrap = wrapperRef.current;
      if (!wrap) return;
      const r = wrap.getBoundingClientRect();
      // Radius is normalised to min(width, height) so a circle stays a circle
      // regardless of the displayed photo's aspect ratio.
      const minDim = Math.min(r.width, r.height);
      const dxPx = (frac.x - mark.overlayX) * r.width;
      const dyPx = (frac.y - mark.overlayY) * r.height;
      const radiusFrac = clampRadius(Math.hypot(dxPx, dyPx) / minDim);
      setMarks((prev) => prev.map((m) => (m.id === dragState.markId ? { ...m, overlayRadius: radiusFrac } : m)));
    }
  }

  function handleDragEnd() {
    if (!dragState) return;
    const mark = marks.find((m) => m.id === dragState.markId);
    setDragState(null);
    if (!mark) return;
    startSavingTransition(async () => {
      setSaveError(null);
      try {
        await updateMark({
          id: mark.id,
          overlayX: mark.overlayX,
          overlayY: mark.overlayY,
          overlayRadius: mark.overlayRadius,
        });
      } catch (err) {
        console.error("updateMark failed", err);
        setSaveError(SAVE_ERROR_MSG);
      }
    });
  }

  function handleLabelBlur(mark: AnnotatorMark) {
    startSavingTransition(async () => {
      setSaveError(null);
      try {
        await updateMark({ id: mark.id, label: mark.label, description: mark.description });
      } catch (err) {
        console.error("updateMark failed", err);
        setSaveError(SAVE_ERROR_MSG);
      }
    });
  }

  function handleDelete(mark: AnnotatorMark) {
    if (!confirm(`Delete mark "${mark.label}"?`)) return;
    startSavingTransition(async () => {
      setSaveError(null);
      try {
        await deleteMark(mark.id);
        setMarks((prev) => prev.filter((m) => m.id !== mark.id));
        if (selectedId === mark.id) setSelectedId(null);
      } catch (err) {
        console.error("deleteMark failed", err);
        setSaveError(SAVE_ERROR_MSG);
      }
    });
  }

  function handleReorder(mark: AnnotatorMark, dir: -1 | 1) {
    const idx = visibleMarks.findIndex((m) => m.id === mark.id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= visibleMarks.length) return;
    const other = visibleMarks[swapIdx];
    // Optimistically swap order locally; capture snapshot for rollback.
    const snapshot = marks.slice();
    setMarks((prev) =>
      prev.map((m) => {
        if (m.id === mark.id) return { ...m, order: other.order };
        if (m.id === other.id) return { ...m, order: mark.order };
        return m;
      }),
    );
    startSavingTransition(async () => {
      setSaveError(null);
      try {
        await swapMarkOrder(mark.id, other.id);
      } catch (err) {
        console.error("swapMarkOrder failed", err);
        setMarks(snapshot);
        setSaveError(SAVE_ERROR_MSG);
      }
    });
  }

  function updateLocalMarkField<K extends "label" | "description">(
    mark: AnnotatorMark,
    field: K,
    value: AnnotatorMark[K],
  ) {
    setMarks((prev) => prev.map((m) => (m.id === mark.id ? { ...m, [field]: value } : m)));
  }

  // Keyboard / no-drag placement (WCAG 2.1.1 + 2.5.7): set ring geometry from
  // the number inputs instead of requiring a pointer drag. Updates local state;
  // the matching onBlur persists via savePosition().
  function updateLocalMarkNumber(
    mark: AnnotatorMark,
    field: "overlayX" | "overlayY" | "overlayRadius",
    value: number,
  ) {
    setMarks((prev) => prev.map((m) => (m.id === mark.id ? { ...m, [field]: value } : m)));
  }

  function savePosition(markId: string) {
    const mark = marks.find((m) => m.id === markId);
    if (!mark) return;
    startSavingTransition(async () => {
      setSaveError(null);
      try {
        await updateMark({
          id: mark.id,
          overlayX: mark.overlayX,
          overlayY: mark.overlayY,
          overlayRadius: mark.overlayRadius,
        });
      } catch (err) {
        console.error("updateMark failed", err);
        setSaveError(SAVE_ERROR_MSG);
      }
    });
  }

  return (
    <div className="space-y-4">
      {saveError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-modal border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger"
        >
          <span>{saveError}</span>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="shrink-0 font-semibold underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}
      {photos.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => {
            const isActive = p.id === photoId;
            const photoMarkCount = marks.filter((m) => m.speciesImageId === p.id).length;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPhotoId(p.id);
                  setSelectedId(null);
                }}
                className={`relative h-16 w-16 overflow-hidden rounded-md border-2 transition ${
                  isActive ? "border-teal-500" : "border-navy-200 hover:border-navy-400"
                }`}
                aria-label={`Reference photo ${p.id} (${photoMarkCount} marks)`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- admin tool, external iNat URLs, no need for next/image optimization */}
                <img
                  src={p.thumbUrl ?? p.url}
                  alt=""
                  className="h-full w-full object-cover"
                />
                {photoMarkCount > 0 && (
                  <span className="absolute right-0.5 top-0.5 rounded bg-teal-600 px-1 text-[10px] font-semibold text-white">
                    {photoMarkCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr,320px]">
        <div className="space-y-2">
          <div
            ref={wrapperRef}
            onPointerDown={handlePhotoPointerDown}
            className="relative w-full select-none overflow-hidden rounded-modal border border-navy-300 bg-navy-100"
            style={{
              aspectRatio:
                activePhoto?.width && activePhoto?.height
                  ? `${activePhoto.width} / ${activePhoto.height}`
                  : "4 / 3",
              cursor: dragState ? "grabbing" : "crosshair",
            }}
          >
            {activePhoto && (
              // eslint-disable-next-line @next/next/no-img-element -- admin tool, external iNat URLs, no need for next/image optimization
              <img
                src={activePhoto.url}
                alt={`Reference photo for ${scientificName}`}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                draggable={false}
              />
            )}
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 1000 1000"
              preserveAspectRatio="none"
              aria-hidden="true"
              onPointerMove={handleDragMove}
              onPointerUp={handleDragEnd}
              onPointerCancel={handleDragEnd}
              style={{ pointerEvents: dragState ? "auto" : "none" }}
            >
              {visibleMarks.map((m, idx) => {
                const cx = m.overlayX * 1000;
                const cy = m.overlayY * 1000;
                const r = m.overlayRadius * 1000;
                const selected = m.id === selectedId;
                return (
                  <g key={m.id} style={{ pointerEvents: "auto" }}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill="rgba(58, 175, 169, 0.18)"
                      stroke={selected ? "#0ea5a5" : "#3aafa9"}
                      strokeWidth={selected ? 6 : 4}
                      strokeDasharray={selected ? "16 10" : undefined}
                      data-markhit="1"
                      onPointerDown={(e) => startMove(e, m)}
                      style={{ cursor: "move" }}
                    />
                    <text
                      x={cx}
                      y={cy - r - 8}
                      textAnchor="middle"
                      fontSize={28}
                      fontWeight={700}
                      fill="#17252a"
                      stroke="#ffffff"
                      strokeWidth={4}
                      paintOrder="stroke"
                      style={{ pointerEvents: "none" }}
                    >
                      {idx + 1}. {m.label}
                    </text>
                    {selected && (
                      <circle
                        cx={cx + r * 0.707}
                        cy={cy - r * 0.707}
                        r={16}
                        fill="#0ea5a5"
                        stroke="#ffffff"
                        strokeWidth={3}
                        data-markhit="1"
                        onPointerDown={(e) => startResize(e, m)}
                        style={{ cursor: "nwse-resize" }}
                      />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          <p className="text-[11px] text-navy-500">
            Click the photo to add a mark. Click an existing ring to select it; drag the ring body to move, drag the
            corner handle to resize. Or select a mark and use the X / Y / Size fields below (arrow keys) to place it
            without dragging. Edits save automatically.
            {isSaving && <span className="ml-2 text-teal-600">Saving…</span>}
          </p>
          {activePhoto?.attribution && (
            <p className="text-[10px] text-navy-400">{activePhoto.attribution}</p>
          )}
        </div>

        <aside className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-navy-600">
            Marks on this photo ({visibleMarks.length})
          </h2>
          {visibleMarks.length === 0 ? (
            <p className="rounded-modal border border-dashed border-navy-300 bg-white p-3 text-[12px] text-navy-500">
              No marks yet. Click on the photo to add the first one.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {visibleMarks.map((m, idx) => {
                const isSel = m.id === selectedId;
                return (
                  <li
                    key={m.id}
                    className={`rounded-modal border p-2 text-[12px] transition ${
                      isSel ? "border-teal-500 bg-teal-50" : "border-navy-200 bg-white hover:border-navy-400"
                    }`}
                  >
                    {/* T18: select-button and reorder-buttons are siblings now
                        (a button cannot legally contain other buttons). */}
                    <div className="flex w-full items-center justify-between gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedId(m.id)}
                        className="flex min-h-[44px] flex-1 items-center text-left font-medium text-navy-900"
                      >
                        {idx + 1}. {m.label || <em className="text-navy-400">(no label)</em>}
                      </button>
                      <span className="flex shrink-0 gap-0.5 text-navy-400">
                        <button
                          type="button"
                          onClick={() => handleReorder(m, -1)}
                          disabled={idx === 0}
                          className="inline-flex h-9 w-9 items-center justify-center rounded hover:bg-navy-100 disabled:opacity-30"
                          aria-label="Move up"
                        >
                          <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                            <path d="M3 7.5L6 4.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReorder(m, 1)}
                          disabled={idx === visibleMarks.length - 1}
                          className="inline-flex h-9 w-9 items-center justify-center rounded hover:bg-navy-100 disabled:opacity-30"
                          aria-label="Move down"
                        >
                          <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                            <path d="M3 4.5L6 7.5l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {selectedMark && (
            <div className="space-y-2 rounded-modal border border-teal-300 bg-white p-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-navy-600">
                Edit mark #{visibleMarks.findIndex((m) => m.id === selectedMark.id) + 1}
              </h3>
              <label className="block">
                <span className="text-[11px] font-medium text-navy-700">Label</span>
                <input
                  type="text"
                  value={selectedMark.label}
                  onChange={(e) => updateLocalMarkField(selectedMark, "label", e.target.value)}
                  onBlur={() => handleLabelBlur(selectedMark)}
                  maxLength={60}
                  className="mt-0.5 block w-full rounded border border-navy-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-navy-700">Description</span>
                <textarea
                  value={selectedMark.description}
                  onChange={(e) => updateLocalMarkField(selectedMark, "description", e.target.value)}
                  onBlur={() => handleLabelBlur(selectedMark)}
                  rows={3}
                  maxLength={280}
                  className="mt-0.5 block w-full rounded border border-navy-300 px-2 py-1 text-[12px] leading-snug focus:border-teal-500 focus:outline-none"
                  placeholder="One sentence: what is this feature and why does it identify the species?"
                />
                <span className="block text-right text-[10px] text-navy-400">
                  {selectedMark.description.length}/280
                </span>
              </label>
              {/* T3: keyboard / no-drag placement. Native number inputs nudge
                  with the arrow keys, so a mark can be positioned and sized
                  without a pointer drag (WCAG 2.1.1 + 2.5.7). */}
              <div className="grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="text-[11px] font-medium text-navy-700">X %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(selectedMark.overlayX * 100)}
                    onChange={(e) => updateLocalMarkNumber(selectedMark, "overlayX", clamp01(Number(e.target.value) / 100))}
                    onBlur={() => savePosition(selectedMark.id)}
                    className="mt-0.5 block w-full rounded border border-navy-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-navy-700">Y %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(selectedMark.overlayY * 100)}
                    onChange={(e) => updateLocalMarkNumber(selectedMark, "overlayY", clamp01(Number(e.target.value) / 100))}
                    onBlur={() => savePosition(selectedMark.id)}
                    className="mt-0.5 block w-full rounded border border-navy-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-navy-700">Size %</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    step={1}
                    value={Math.round(selectedMark.overlayRadius * 100)}
                    onChange={(e) => updateLocalMarkNumber(selectedMark, "overlayRadius", clampRadius(Number(e.target.value) / 100))}
                    onBlur={() => savePosition(selectedMark.id)}
                    className="mt-0.5 block w-full rounded border border-navy-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none"
                  />
                </label>
              </div>
              <p className="sr-only" aria-live="polite">
                Mark {visibleMarks.findIndex((m) => m.id === selectedMark.id) + 1} at{" "}
                {Math.round(selectedMark.overlayX * 100)} percent across,{" "}
                {Math.round(selectedMark.overlayY * 100)} percent down, radius{" "}
                {Math.round(selectedMark.overlayRadius * 100)} percent.
              </p>
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => handleDelete(selectedMark)}
                  className="inline-flex items-center gap-1 text-[11px] text-danger hover:opacity-80"
                >
                  <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden="true">
                    <path d="M2.5 3.5h7M5 3.5V2.5h2v1M3.5 3.5l.5 6h4l.5-6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Delete mark
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="text-[11px] text-navy-500 hover:text-navy-700"
                >
                  Deselect
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
