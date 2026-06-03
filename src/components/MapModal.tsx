"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import { useModalFocus } from "@/lib/useModalFocus";

const MapModalInner = dynamic(() => import("./MapModalInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-white/70">
      Loading map…
    </div>
  ),
});

interface MapModalProps {
  open: boolean;
  onClose: () => void;
  lat: number;
  lon: number;
  site: string;
}

export function MapModal({ open, onClose, lat, lon, site }: MapModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Focus trap + restore + Escape + scroll lock (F-MODAL-FOCUS). The map
  // opens over the active feed card, so without a trap keyboard users could
  // tab onto the live feed / MCQ controls underneath (WCAG 2.1.2). Shared
  // hook lifted from IdGuideSheet's proven implementation.
  useModalFocus(open, dialogRef, onClose);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Location of ${site}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-0 sm:p-6"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden bg-navy-800 shadow-menu sm:h-[70vh] sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-eyebrow text-teal-50">
              {site}
            </p>
            <p className="truncate text-xs text-white/65">
              {lat.toFixed(4)}, {lon.toFixed(4)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close map"
            className="ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/85 hover:bg-white/20"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="relative flex-1">
          <MapModalInner lat={lat} lon={lon} site={site} />
        </div>
      </div>
    </div>
  );
}
