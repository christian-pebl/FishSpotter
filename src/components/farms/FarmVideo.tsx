"use client";

import { useState } from "react";
import type { FarmVideo as FarmVideoType } from "@/lib/farms/traits";

/**
 * Click-to-load video facade. Shows a poster (the farm's hero photo) with a
 * play button; only when the viewer clicks does the third-party iframe load,
 * so no YouTube/Vimeo request is made on page load. YouTube uses the
 * privacy-friendly nocookie host.
 */
export function FarmVideo({
  video,
  poster,
  farmName,
}: {
  video: FarmVideoType;
  poster?: string;
  farmName: string;
}) {
  const [playing, setPlaying] = useState(false);

  const embedSrc =
    video.provider === "youtube"
      ? `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`
      : `https://player.vimeo.com/video/${video.id}?autoplay=1`;

  return (
    <section className="mt-6">
      <h2 className="mb-2 font-brand-heading text-h3 text-navy-900">Watch the farm</h2>
      <div className="relative aspect-video overflow-hidden rounded-card bg-navy-900">
        {playing ? (
          <iframe
            src={embedSrc}
            title={video.title ?? `${farmName} film`}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play ${farmName} film`}
            className="group absolute inset-0 h-full w-full"
          >
            {poster && (
              /* eslint-disable-next-line @next/next/no-img-element -- local static asset */
              <img
                src={poster}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-80 transition group-hover:opacity-100"
              />
            )}
            <span className="absolute inset-0 bg-navy-900/30 transition group-hover:bg-navy-900/20" />
            <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-menu transition group-hover:scale-105">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 7.5v9l7-4.5-7-4.5Z" fill="currentColor" className="text-teal-600" />
              </svg>
            </span>
            {video.title && (
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-900/80 to-transparent p-3 text-left text-sm font-medium text-white">
                {video.title}
              </span>
            )}
          </button>
        )}
      </div>
    </section>
  );
}
