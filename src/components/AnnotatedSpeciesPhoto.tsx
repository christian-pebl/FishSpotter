"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/lib/motion";
import type { SpeciesImagePayload, SpeciesMarkPayload } from "@/app/api/species-images/[scientificName]/route";

type Status = "idle" | "loading" | "ready" | "empty" | "error";

type AnnotatedImage = {
  image: SpeciesImagePayload;
  marks: SpeciesMarkPayload[];
};

/**
 * Teaching-sequence cadence for the diagnostic-ring draw-on.
 *
 * Bespoke (not a `@/lib/motion` token): the rings DRAW ON one at a time as a
 * guided "look here, now here" lesson, so they want a slower, more deliberate
 * beat than the generic enter/exit tiers. ~0.5s for a ring to trace itself,
 * ~0.4s between consecutive rings, with the badge + legend row for ring N
 * landing just as that ring finishes closing.
 */
const RING_DRAW_S = 0.5;
const RING_STAGGER_S = 0.4;
const BADGE_FADE_S = 0.22;
// Badge + legend row appear as the ring nears completion (most of the circle is
// already on screen) so the number reads against a drawn ring, not an empty gap.
const BADGE_LEAD_FRACTION = 0.7;

/** Per-mark animation delay (seconds), shared by the SVG ring + HTML legend
 *  row so the two stay in exact lockstep across their separate DOM subtrees. */
function ringDelay(idx: number) {
  return idx * RING_STAGGER_S;
}
function badgeDelay(idx: number) {
  return ringDelay(idx) + RING_DRAW_S * BADGE_LEAD_FRACTION;
}

/**
 * S9-T1 PR3 : diagnostic-mark renderer for the IdGuideWizard reveal.
 *
 * Picks the species' first photo that carries authored marks (curated
 * order from the API already prioritises those photos via the gallery
 * sort), renders it with numbered SVG rings on top, and lists the
 * labels + descriptions in a numbered legend below. The numbers on
 * the rings line up with the numbers in the legend so a learner can
 * map "what to look for" to "where on the fish".
 *
 * The rings DRAW ON one by one (Framer `pathLength` 0->1, staggered) as a
 * teaching sequence, each numbered legend row fading in in sync with its
 * ring. Under prefers-reduced-motion the full annotated state (every ring +
 * the complete legend) renders statically at once.
 *
 * If the species has no marks (or photos are unavailable), the parent
 * component should fall back to the plain SpeciesGallery : this
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

  return (
    <AnnotatedSpeciesPhotoView
      image={data.image}
      marks={data.marks}
      commonName={commonName}
    />
  );
}

/**
 * Presentational core: the annotated photo + draw-on ring sequence + legend,
 * decoupled from the network so it can be exercised in isolation (Storybook)
 * with mock data. The fetching `AnnotatedSpeciesPhoto` above is a thin wrapper
 * around this. Ring/badge geometry, numbering and aspect-ratio handling are
 * unchanged from the original static renderer.
 *
 * `replayKey` lets a host (e.g. the story's Replay control) remount the
 * sequence to play it again; `forceReduceMotion` overrides the OS setting so
 * the static end state can be demonstrated without changing system prefs.
 */
export function AnnotatedSpeciesPhotoView({
  image,
  marks,
  commonName,
  replayKey = 0,
  forceReduceMotion,
}: {
  image: SpeciesImagePayload;
  marks: SpeciesMarkPayload[];
  commonName: string;
  replayKey?: number;
  forceReduceMotion?: boolean;
}) {
  const systemReduce = useReducedMotion();
  const reduce = forceReduceMotion ?? systemReduce ?? false;

  const aspectRatio =
    image.width && image.height ? `${image.width} / ${image.height}` : "4 / 3";

  const W = image.width ?? 1000;
  const H = image.height ?? 1000;
  const S = Math.min(W, H); // scale reference : same as the admin annotator

  // Geometry is pure given the image + marks, so memoise it. Identical maths to
  // the original static component; only the render wraps motion around it.
  const geometry = useMemo(
    () =>
      marks.map((m, idx) => {
        const cx = m.overlayX * W;
        const cy = m.overlayY * H;
        const r = m.overlayRadius * S;
        // Badge sizes scale with the image so they look the same on
        // 800×600 and 1920×1080 source images.
        const badgeR = S * 0.024;
        const ringStroke = S * 0.004; // thinner ring
        const badgeStroke = S * 0.004;
        const fontSize = S * 0.026;
        const textOffsetY = fontSize * 0.35;
        // Badge sits just OUTSIDE the ring on a diagonal so the number
        // never covers the feature. Prefer upper-right, but fall back to
        // the first diagonal (UR, UL, LR, LL) that keeps the badge fully in
        // frame, so a ring near an edge can't clip its badge off-screen.
        const badgeDist = r + badgeR + S * 0.012;
        const diag = badgeDist * 0.707;
        const corners: Array<[number, number]> = [
          [cx + diag, cy - diag],
          [cx - diag, cy - diag],
          [cx + diag, cy + diag],
          [cx - diag, cy + diag],
        ];
        const [bx, by] =
          corners.find(
            ([tx, ty]) =>
              tx - badgeR >= 0 && tx + badgeR <= W && ty - badgeR >= 0 && ty + badgeR <= H,
          ) ?? corners[0];
        return { idx, m, cx, cy, r, badgeR, ringStroke, badgeStroke, fontSize, textOffsetY, bx, by };
      }),
    [marks, W, H, S],
  );

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
          // Remounting on replayKey restarts the draw-on sequence from frame 0.
          key={`rings-${replayKey}`}
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${image.width ?? 1000} ${image.height ?? 1000}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          {geometry.map((g) => (
            <g key={`${g.idx}-${g.m.label}`}>
              <motion.circle
                cx={g.cx}
                cy={g.cy}
                r={g.r}
                fill="rgba(20, 184, 166, 0.18)"
                stroke="#5eead4"
                strokeWidth={g.ringStroke}
                strokeLinecap="round"
                // Reduced motion: render the closed ring immediately (static
                // end state). Otherwise trace it on with pathLength 0->1.
                initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                animate={reduce ? undefined : { pathLength: 1, opacity: 1 }}
                transition={
                  reduce
                    ? undefined
                    : { duration: RING_DRAW_S, ease: EASE.enter, delay: ringDelay(g.idx) }
                }
              />
              {/* Numbered badge just outside the ring's upper-right so it
                  never obscures the feature inside the circle. Fades in as the
                  ring closes (it's a label, not a stroke to trace). */}
              <motion.g
                initial={reduce ? false : { opacity: 0 }}
                animate={reduce ? undefined : { opacity: 1 }}
                transition={
                  reduce
                    ? undefined
                    : { duration: BADGE_FADE_S, ease: EASE.enter, delay: badgeDelay(g.idx) }
                }
              >
                <circle
                  cx={g.bx}
                  cy={g.by}
                  r={g.badgeR}
                  fill="#0f766e"
                  stroke="#ffffff"
                  strokeWidth={g.badgeStroke}
                />
                <text
                  x={g.bx}
                  y={g.by + g.textOffsetY}
                  textAnchor="middle"
                  fontSize={g.fontSize}
                  fontWeight={700}
                  fill="#ffffff"
                >
                  {g.idx + 1}
                </text>
              </motion.g>
            </g>
          ))}
        </svg>
      </div>
      <ol
        // Remount with the rings so legend rows re-stagger on replay.
        key={`legend-${replayKey}`}
        className="space-y-1.5 text-[11px] leading-relaxed text-white/85"
      >
        {marks.map((m, idx) => (
          <motion.li
            key={`${idx}-${m.label}`}
            className="flex gap-2"
            // Each legend row fades in in sync with its ring's badge, so the
            // number you can read on the photo and the number in the list light
            // up together. Reduced motion -> all rows shown at once.
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={
              reduce
                ? undefined
                : { duration: BADGE_FADE_S, ease: EASE.enter, delay: badgeDelay(idx) }
            }
          >
            <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-teal-500 text-[9px] font-bold text-navy-900">
              {idx + 1}
            </span>
            <span>
              <span className="font-semibold text-white/95">{m.label}.</span>{" "}
              {m.description && <span className="text-white/70">{m.description}</span>}
            </span>
          </motion.li>
        ))}
      </ol>
      {image.attribution && (
        <p className="text-[10px] text-white/55">{image.attribution}</p>
      )}
    </div>
  );
}
