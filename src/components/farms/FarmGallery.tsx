"use client";

import { useRef, useState, useCallback } from "react";
import { useModalFocus } from "@/lib/useModalFocus";
import type { FarmImage } from "@/lib/farms/traits";

/**
 * A small grid of real farm photos with a lightbox. Locally hosted images
 * (public/farm-media/...), so nothing hotlinks. Keyboard: Escape closes,
 * arrows step through. Credit line (photographer/attribution) sits below.
 */
export function FarmGallery({
  images,
  credit,
}: {
  images: FarmImage[];
  credit?: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const open = openIndex !== null;

  const close = useCallback(() => setOpenIndex(null), []);
  useModalFocus(open, dialogRef, close);

  const step = useCallback(
    (delta: number) =>
      setOpenIndex((i) => (i === null ? i : (i + delta + images.length) % images.length)),
    [images.length],
  );

  if (images.length === 0) return null;

  return (
    <section className="mt-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {images.map((img, i) => (
          <button
            key={img.src}
            type="button"
            onClick={() => setOpenIndex(i)}
            aria-label={`View photo: ${img.alt}`}
            className="group relative aspect-[4/3] overflow-hidden rounded-modal bg-navy-900/5 ring-1 ring-navy-900/10 transition hover:ring-teal-400"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local static asset */}
            <img
              src={img.src}
              alt={img.alt}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </button>
        ))}
      </div>
      {credit && <p className="mt-2 text-[11px] text-navy-900/45">{credit}</p>}

      {open && openIndex !== null && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={images[openIndex].alt}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close photo"
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/85 hover:bg-white/20"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
                aria-label="Previous photo"
                className="absolute left-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/85 hover:bg-white/20"
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
                aria-label="Next photo"
                className="absolute right-3 bottom-1/2 flex h-11 w-11 translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white/85 hover:bg-white/20 sm:right-16"
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          )}

          <figure className="flex max-h-full max-w-3xl flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element -- local static asset */}
            <img
              src={images[openIndex].src}
              alt={images[openIndex].alt}
              className="max-h-[80vh] w-auto rounded-modal object-contain"
            />
            <figcaption className="mt-2 max-w-xl text-center text-xs text-white/70">
              {images[openIndex].alt}
              {credit && <span className="mt-0.5 block text-white/45">{credit}</span>}
            </figcaption>
          </figure>
        </div>
      )}
    </section>
  );
}
