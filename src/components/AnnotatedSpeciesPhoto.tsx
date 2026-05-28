"use client";

import { useEffect, useState } from "react";
import type { SpeciesImagePayload, SpeciesMarkPayload } from "@/app/api/species-images/[scientificName]/route";

type Status = "idle" | "loading" | "ready" | "empty" | "error";

type AnnotatedImage = {
  image: SpeciesImagePayload;
  marks: SpeciesMarkPayload[];
};

/**
 * S9-T1 PR3 — diagnostic-mark renderer for the IdGuideWizard reveal.
 *
 * Picks the species' first photo that carries authored marks (curated
 * order from the API already prioritises those photos via the gallery
 * sort), renders it with numbered SVG rings on top, and lists the
 * labels + descriptions in a numbered legend below. The numbers on
 * the rings line up with the numbers in the legend so a learner can
 * map "what to look for" to "where on the fish".
 *
 * If the species has no marks (or photos are unavailable), the parent
 * component should fall back to the plain SpeciesGallery — this
 * component returns null in that case.
 */
export function AnnotatedSpeciesPhoto({
  scientificName,
  commonName,
}: {
  scientificName: string;
  commonName: string;
}) {
  const [data, setData] = useState<AnnotatedImage | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setData(null);
    fetch(`/api/species-images/${encodeURIComponent(scientificName)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
      .then((body: { images: SpeciesImagePayload[] }) => {
        if (cancelled) return;
        const withMarks = body.images.find((img) => img.marks.length > 0);
        if (!withMarks) {
          setStatus("empty");
          return;
        }
        setData({ image: withMarks, marks: withMarks.marks });
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [scientificName]);

  if (status !== "ready" || !data) return null;

  const { image, marks } = data;
  const aspectRatio =
    image.width && image.height ? `${image.width} / ${image.height}` : "4 / 3";

  return (
    <div className="space-y-2">
      <div
        className="relative w-full overflow-hidden rounded-lg border border-white/15 bg-navy-900"
        style={{ aspectRatio }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- external iNat URL, lightweight overlay context */}
        <img
          src={image.url}
          alt={`Reference photo of ${commonName}`}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
        {/* P-6: viewBox matches image dimensions + xMidYMid meet so the
            SVG coordinate space aligns exactly with the displayed image.
            "none" caused rings to render as ellipses on non-square photos
            because x and y axes were scaled independently. */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${image.width ?? 1000} ${image.height ?? 1000}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          {marks.map((m, idx) => {
            const W = image.width ?? 1000;
            const H = image.height ?? 1000;
            const S = Math.min(W, H); // scale reference — same as the admin annotator
            const cx = m.overlayX * W;
            const cy = m.overlayY * H;
            const r = m.overlayRadius * S;
            // Badge sizes scale with the image so they look the same on
            // 800×600 and 1920×1080 source images.
            const badgeR = S * 0.025;
            const ringStroke = S * 0.006;
            const badgeStroke = S * 0.004;
            const fontSize = S * 0.028;
            const textOffsetY = fontSize * 0.35;
            return (
              <g key={`${idx}-${m.label}`}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="rgba(20, 184, 166, 0.18)"
                  stroke="#5eead4"
                  strokeWidth={ringStroke}
                />
                {/* Numbered badge at the ring's upper-right so it doesn't
                    obscure the feature itself. */}
                <circle
                  cx={cx + r * 0.707}
                  cy={cy - r * 0.707}
                  r={badgeR}
                  fill="#0f766e"
                  stroke="#ffffff"
                  strokeWidth={badgeStroke}
                />
                <text
                  x={cx + r * 0.707}
                  y={cy - r * 0.707 + textOffsetY}
                  textAnchor="middle"
                  fontSize={fontSize}
                  fontWeight={700}
                  fill="#ffffff"
                >
                  {idx + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <ol className="space-y-1.5 text-[11px] leading-relaxed text-white/85">
        {marks.map((m, idx) => (
          <li key={`${idx}-${m.label}`} className="flex gap-2">
            <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-teal-500 text-[9px] font-bold text-navy-900">
              {idx + 1}
            </span>
            <span>
              <span className="font-semibold text-white/95">{m.label}.</span>{" "}
              {m.description && <span className="text-white/70">{m.description}</span>}
            </span>
          </li>
        ))}
      </ol>
      {image.attribution && (
        <p className="text-[10px] text-white/40">{image.attribution}</p>
      )}
    </div>
  );
}
