"use client";

import { useEffect, useState } from "react";
import type { SpeciesImagePayload } from "@/app/api/species-images/[scientificName]/route";

type Status = "idle" | "loading" | "ready" | "empty" | "error";

export function SpeciesGallery({
  scientificName,
  commonName,
  size = "thumb",
}: {
  scientificName: string;
  commonName: string;
  /** "thumb" for inline strip on candidate cards; "large" for the field-note hero. */
  size?: "thumb" | "large";
}) {
  const [images, setImages] = useState<SpeciesImagePayload[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetch(`/api/species-images/${encodeURIComponent(scientificName)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { images: SpeciesImagePayload[] }) => {
        if (cancelled) return;
        setImages(data.images);
        setStatus(data.images.length > 0 ? "ready" : "empty");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [scientificName]);

  if (status === "idle" || status === "loading") {
    return (
      <div className={size === "large" ? "h-32 animate-pulse rounded-xl bg-white/5" : "h-14 animate-pulse rounded-lg bg-white/5"} />
    );
  }
  if (status === "empty" || status === "error") {
    return null; // Quietly absent — UI shouldn't punish missing media.
  }

  const tileClass =
    size === "large"
      ? "h-32 w-32 shrink-0 overflow-hidden rounded-xl"
      : "h-14 w-14 shrink-0 overflow-hidden rounded-lg";

  return (
    <>
      <div
        className="-mx-1 flex snap-x snap-mandatory gap-1.5 overflow-x-auto overscroll-x-contain px-1 pb-1"
        aria-label={`Photos of ${commonName}`}
      >
        {images.map((img, i) => {
          const label =
            [img.lifeStage, img.sex].filter(Boolean).join(" / ") || null;
          return (
            <button
              key={img.sourceUrl}
              type="button"
              onClick={() => setLightboxIdx(i)}
              className={`${tileClass} group relative snap-start border border-white/10 transition-transform hover:scale-[1.02]`}
              aria-label={`Photo of ${commonName}${label ? ` (${label})` : ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.thumbUrl ?? img.url}
                alt=""
                aria-hidden
                loading="lazy"
                className="h-full w-full object-cover"
              />
              {label && (
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-center text-[9px] uppercase tracking-wider text-white/90">
                  {label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {lightboxIdx !== null && images[lightboxIdx] && (
        <Lightbox
          image={images[lightboxIdx]}
          commonName={commonName}
          onClose={() => setLightboxIdx(null)}
          onNext={
            lightboxIdx + 1 < images.length
              ? () => setLightboxIdx((i) => (i ?? 0) + 1)
              : null
          }
          onPrev={
            lightboxIdx > 0 ? () => setLightboxIdx((i) => (i ?? 1) - 1) : null
          }
        />
      )}
    </>
  );
}

function Lightbox({
  image,
  commonName,
  onClose,
  onNext,
  onPrev,
}: {
  image: SpeciesImagePayload;
  commonName: string;
  onClose: () => void;
  onNext: (() => void) | null;
  onPrev: (() => void) | null;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && onNext) onNext();
      else if (e.key === "ArrowLeft" && onPrev) onPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNext, onPrev]);

  const label = [image.lifeStage, image.sex].filter(Boolean).join(" / ");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo of ${commonName}`}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/85 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[85vh] w-full max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt={`${commonName}${label ? ` (${label})` : ""}`}
          className="mx-auto max-h-[75vh] w-auto rounded-xl object-contain"
        />
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-[11px] text-white/70">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-white/90">{commonName}</span>
            {label && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider">
                {label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <a
              href={image.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              {image.attribution}
            </a>
            <span className="text-white/40">{image.license}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo"
          className="absolute -top-3 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        {onPrev && (
          <button
            type="button"
            onClick={onPrev}
            aria-label="Previous photo"
            className="absolute left-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75"
          >
            ‹
          </button>
        )}
        {onNext && (
          <button
            type="button"
            onClick={onNext}
            aria-label="Next photo"
            className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75"
          >
            ›
          </button>
        )}
      </div>
    </div>
  );
}
