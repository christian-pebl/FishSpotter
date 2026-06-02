"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SpeciesImagePayload } from "@/app/api/species-images/[scientificName]/route";

type Status = "idle" | "loading" | "ready" | "empty" | "error";

const LICENSE_DEEDS: Record<string, string> = {
  "cc0": "https://creativecommons.org/publicdomain/zero/1.0/",
  "cc-by": "https://creativecommons.org/licenses/by/4.0/",
  "cc-by-sa": "https://creativecommons.org/licenses/by-sa/4.0/",
  "cc-by-nc": "https://creativecommons.org/licenses/by-nc/4.0/",
  "cc-by-nc-sa": "https://creativecommons.org/licenses/by-nc-sa/4.0/",
  "cc-by-nd": "https://creativecommons.org/licenses/by-nd/4.0/",
  "cc-by-nc-nd": "https://creativecommons.org/licenses/by-nc-nd/4.0/",
};

function licenseHref(code: string): string | null {
  return LICENSE_DEEDS[code.toLowerCase()] ?? null;
}

export function SpeciesGallery({
  scientificName,
  commonName,
  size = "thumb",
}: {
  scientificName: string;
  commonName: string;
  size?: "thumb" | "large";
}) {
  const [images, setImages] = useState<SpeciesImagePayload[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // S2-T17: extracted fetch so the retry button can re-run it.
  // `retryToken` bumps on click; the effect rerun reissues the GET.
  const [retryToken, setRetryToken] = useState(0);
  const retry = useCallback(() => setRetryToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    // Reset lightbox state when the species changes so a stale index from a
    // previous species doesn't open the wrong photo.
    setLightboxIdx(null);
    let autoRetried = false;
    const run = (): Promise<void> =>
      fetch(`/api/species-images/${encodeURIComponent(scientificName)}`)
        .then((r) => {
          if (r.ok) return r.json();
          // S2-T17: one auto-retry with 1s backoff for transient 5xx.
          if (!autoRetried && r.status >= 500 && r.status < 600) {
            autoRetried = true;
            return new Promise<void>((resolve) =>
              setTimeout(resolve, 1000),
            ).then(run);
          }
          return Promise.reject(new Error(`HTTP ${r.status}`));
        })
        .then((data?: { images: SpeciesImagePayload[] }) => {
          if (cancelled || !data) return;
          setImages(data.images);
          setStatus(data.images.length > 0 ? "ready" : "empty");
        })
        .catch(() => {
          if (!cancelled) setStatus("error");
        });
    void run();
    return () => {
      cancelled = true;
    };
  }, [scientificName, retryToken]);

  const closeLightbox = useCallback(() => {
    setLightboxIdx((current) => {
      if (current !== null) thumbRefs.current[current]?.focus();
      return null;
    });
  }, []);
  const showNext = useCallback(
    () => setLightboxIdx((i) => (i !== null && i + 1 < images.length ? i + 1 : i)),
    [images.length],
  );
  const showPrev = useCallback(
    () => setLightboxIdx((i) => (i !== null && i > 0 ? i - 1 : i)),
    [],
  );

  if (status === "idle" || status === "loading") {
    return (
      <div
        className={
          size === "large"
            ? "h-32 animate-pulse motion-reduce:animate-none rounded-xl bg-white/5"
            : "h-14 animate-pulse motion-reduce:animate-none rounded-lg bg-white/5"
        }
      />
    );
  }
  if (status === "empty") {
    // S2-T17: field-note view (size=large) shows placeholder copy
    // so the gap doesn't look like a layout bug. Inline thumb mode
    // stays silent — the field-note sheet remains the fallback for
    // species with no community photos yet.
    if (size === "large") {
      return (
        <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/55">
          Photos coming soon — iNaturalist has no community CC-licensed photos for {commonName} yet.
        </p>
      );
    }
    return null;
  }
  if (status === "error") {
    if (size === "large") {
      return (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/55">
          <span>Photos unavailable right now.</span>
          <button
            type="button"
            onClick={retry}
            className="rounded-full border border-white/30 px-2 py-0.5 text-[10px] font-semibold text-white hover:border-teal-500"
          >
            Retry
          </button>
        </div>
      );
    }
    return null;
  }

  const tileClass =
    size === "large"
      ? "h-32 w-32 shrink-0 overflow-hidden rounded-xl"
      : "h-14 w-14 shrink-0 overflow-hidden rounded-lg";

  return (
    <>
      <ul
        role="list"
        aria-label={`Photos of ${commonName} (${images.length})`}
        className="-mx-1 flex snap-x snap-mandatory list-none gap-1.5 overflow-x-auto overscroll-x-contain px-1 pb-1"
      >
        {images.map((img, i) => {
          const label = [img.lifeStage, img.sex].filter(Boolean).join(" / ") || null;
          return (
            <li key={`${img.sourceUrl}-${i}`} role="listitem" className="shrink-0">
              <button
                ref={(el) => {
                  thumbRefs.current[i] = el;
                }}
                type="button"
                onClick={() => setLightboxIdx(i)}
                className={`${tileClass} group relative snap-start border border-white/10 transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70`}
                aria-label={`Open photo of ${commonName}${label ? ` (${label})` : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={size === "large" ? img.url : img.thumbUrl ?? img.url}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
                {label && (
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/80 px-1 py-0.5 text-center text-[9px] uppercase tracking-wider text-white">
                    {label}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {lightboxIdx !== null && images[lightboxIdx] && (
        <LightboxPortal
          image={images[lightboxIdx]}
          commonName={commonName}
          onClose={closeLightbox}
          onNext={lightboxIdx + 1 < images.length ? showNext : null}
          onPrev={lightboxIdx > 0 ? showPrev : null}
          position={`${lightboxIdx + 1} of ${images.length}`}
        />
      )}
    </>
  );
}

function LightboxPortal(props: React.ComponentProps<typeof Lightbox>) {
  // Portal to body so a `transform` on an ancestor (e.g. the field-note
  // sheet's keyboard-offset translate) can't trap our `fixed` overlay
  // inside its containing block.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(<Lightbox {...props} />, document.body);
}

function Lightbox({
  image,
  commonName,
  onClose,
  onNext,
  onPrev,
  position,
}: {
  image: SpeciesImagePayload;
  commonName: string;
  onClose: () => void;
  onNext: (() => void) | null;
  onPrev: (() => void) | null;
  position: string;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  // Track whether the pointer-down started on the backdrop. Closing only on
  // mouseup-on-backdrop-AFTER-mousedown-on-backdrop prevents a drag that
  // begins on text (e.g. selecting attribution) and ends on the backdrop
  // from dismissing the dialog.
  const pointerDownOnBackdrop = useRef(false);

  useEffect(() => {
    // Move focus into the dialog on mount so screen readers / keyboard users
    // are placed inside the overlay rather than on the body.
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight" && onNext) {
        e.preventDefault();
        onNext();
      } else if (e.key === "ArrowLeft" && onPrev) {
        e.preventDefault();
        onPrev();
      } else if (e.key === "Tab") {
        // Minimal focus trap: keep focus inside the dialog.
        const root = dialogRef.current;
        if (!root) return;
        const focusables = root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNext, onPrev]);

  const label = [image.lifeStage, image.sex].filter(Boolean).join(" / ");
  const licenseLink = licenseHref(image.license);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Photo of ${commonName}${label ? ` (${label})` : ""}, ${position}`}
      tabIndex={-1}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/85 p-4 outline-none"
      onMouseDown={(e) => {
        pointerDownOnBackdrop.current = e.target === e.currentTarget;
      }}
      onMouseUp={(e) => {
        if (pointerDownOnBackdrop.current && e.target === e.currentTarget) {
          onClose();
        }
        pointerDownOnBackdrop.current = false;
      }}
    >
      <div
        className="relative max-h-[85vh] w-full max-w-3xl"
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        // S2-T18: touch-swipe navigation. Threshold 60px; vertical
        // dominant swipe down closes the dialog; horizontal dominant
        // swipe advances/retreats. Disabled when the user prefers
        // reduced motion (treat swipe as motion).
        onTouchStart={(e) => {
          if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
          const t = e.touches[0];
          (e.currentTarget as HTMLDivElement).dataset.tsx = String(t.clientX);
          (e.currentTarget as HTMLDivElement).dataset.tsy = String(t.clientY);
        }}
        onTouchEnd={(e) => {
          const root = e.currentTarget as HTMLDivElement;
          const sx = Number(root.dataset.tsx ?? "");
          const sy = Number(root.dataset.tsy ?? "");
          if (!Number.isFinite(sx) || !Number.isFinite(sy)) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - sx;
          const dy = t.clientY - sy;
          const THRESH = 60;
          delete root.dataset.tsx;
          delete root.dataset.tsy;
          if (Math.abs(dx) > Math.abs(dy)) {
            if (dx <= -THRESH && onNext) onNext();
            else if (dx >= THRESH && onPrev) onPrev();
          } else if (dy >= THRESH) {
            onClose();
          }
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt={`${commonName}${label ? `, ${label}` : ""}`}
          className="mx-auto max-h-[75vh] w-auto rounded-xl object-contain"
        />
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-[11px] text-white/75">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-white/90">{commonName}</span>
            {label && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider">
                {label}
              </span>
            )}
            <span className="text-white/40">{position}</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={image.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline hover:text-white"
            >
              {image.attribution}
              {/* S2-T18: external-link affordance so the link target is obvious. */}
              <svg
                width="10"
                height="10"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
                className="opacity-60"
              >
                <path d="M5 1H11V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M11 1L5 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 7v3.5a.5.5 0 01-.5.5h-7a.5.5 0 01-.5-.5v-7a.5.5 0 01.5-.5H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            {licenseLink ? (
              <a
                href={licenseLink}
                target="_blank"
                rel="noopener noreferrer license"
                className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider hover:bg-white/20"
              >
                {image.license}
              </a>
            ) : (
              <span className="text-white/40">{image.license}</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo"
          className="absolute -top-2 right-1 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        {onPrev && (
          <button
            type="button"
            onClick={onPrev}
            aria-label="Previous photo"
            className="absolute left-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3.5L5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        {onNext && (
          <button
            type="button"
            onClick={onNext}
            aria-label="Next photo"
            className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
