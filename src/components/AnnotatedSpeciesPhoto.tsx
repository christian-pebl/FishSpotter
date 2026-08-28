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
 * Teaching-sequence cadence for the diagnostic-marker pop-in.
 *
 * Bespoke (not a `@/lib/motion` token): the numbered markers pop in one at a
 * time as a guided "look here, now here" lesson, so they want a slower, more
 * deliberate beat than the generic enter/exit tiers. ~0.28s for a marker to
 * pop in, ~0.35s between consecutive markers, with the legend row for marker
 * N landing in lockstep with its marker.
 */
const MARK_POP_S = 0.28;
const MARK_STAGGER_S = 0.35;

/** Per-mark animation delay (seconds), shared by the SVG marker + HTML legend
 *  row so the two stay in exact lockstep across their separate DOM subtrees. */
function markDelay(idx: number) {
  return idx * MARK_STAGGER_S;
}

/** Clamp a marker centre so its badge stays fully inside the frame. */
function clampAxis(v: number, badgeR: number, max: number) {
  return Math.max(badgeR, Math.min(max - badgeR, v));
}

/**
 * Nudge marker centres apart so two never fully overlap. Real case that
 * surfaced this: a handful of species have two authored marks that both
 * describe a whole-body/radiating feature ("five stubby arms", "pentagon
 * outline") rather than a single point, so their authored centres land on
 * (or near) the exact same spot. A drawn ring tolerated that; a small solid
 * dot does not, an opaque dot fully hides an identical dot beneath it. This
 * is a rendering safety net, not a fix for the underlying authoring issue.
 */
function separateOverlaps<T extends { cx: number; cy: number }>(points: T[], minSep: number): T[] {
  const out = points.map((p) => ({ ...p }));
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const dx = out[j].cx - out[i].cx;
      const dy = out[j].cy - out[i].cy;
      const dist = Math.hypot(dx, dy);
      if (dist >= minSep) continue;
      // Push apart along the vector between them; if they're (near-)identical
      // there's no meaningful direction, so fan duplicates out at fixed angles
      // (deterministic in mark order, not layout-dependent).
      const [ux, uy] =
        dist < 0.01
          ? [Math.cos((j - i) * (Math.PI / 3)), Math.sin((j - i) * (Math.PI / 3))]
          : [dx / dist, dy / dist];
      const push = (minSep - dist) / 2;
      out[i].cx -= ux * push;
      out[i].cy -= uy * push;
      out[j].cx += ux * push;
      out[j].cy += uy * push;
    }
  }
  return out;
}

/**
 * S9-T1 PR3 : diagnostic-mark renderer for the IdGuideWizard reveal.
 *
 * Picks the species' first photo that carries authored marks (curated
 * order from the API already prioritises those photos via the gallery
 * sort), renders it with small numbered markers pinned exactly on each
 * feature, and lists the labels + descriptions in a numbered legend below.
 * The numbers on the photo line up with the numbers in the legend so a
 * learner can map "what to look for" to "where on the fish". Deliberately
 * no ring/halo around the feature: a big circle drawn over the fish reads as
 * distracting clutter, a small number pinned exactly on the feature does not.
 *
 * The markers pop in one by one (staggered), each numbered legend row fading
 * in in sync with its marker. Under prefers-reduced-motion the full
 * annotated state (every marker + the complete legend) renders statically at
 * once.
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
 * Presentational core: the annotated photo + marker pop-in sequence + legend,
 * decoupled from the network so it can be exercised in isolation (Storybook)
 * with mock data. The fetching `AnnotatedSpeciesPhoto` above is a thin wrapper
 * around this.
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

  // Geometry is pure given the image + marks, so memoise it. The marker sits
  // exactly on the feature's authored centre (overlayX/overlayY); overlayRadius
  // no longer drives a drawn ring, only clamped so the marker never touches the
  // frame edge. A separation pass then nudges apart any pair of markers whose
  // authored centres coincide (or nearly do), so one solid dot can never fully
  // hide another.
  const geometry = useMemo(() => {
    // Marker sizes scale with the image so they look the same on
    // 800×600 and 1920×1080 source images.
    const badgeR = S * 0.026;
    const badgeStroke = S * 0.004;
    const fontSize = S * 0.028;
    const textOffsetY = fontSize * 0.35;
    const raw = marks.map((m, idx) => ({
      idx,
      m,
      cx: clampAxis(m.overlayX * W, badgeR, W),
      cy: clampAxis(m.overlayY * H, badgeR, H),
    }));
    const separated = separateOverlaps(raw, badgeR * 2.4);
    return separated.map((p) => ({
      ...p,
      cx: clampAxis(p.cx, badgeR, W),
      cy: clampAxis(p.cy, badgeR, H),
      badgeR,
      badgeStroke,
      fontSize,
      textOffsetY,
    }));
  }, [marks, W, H, S]);

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
            "none" caused markers to render off-position on non-square photos
            because x and y axes were scaled independently. */}
        <svg
          // Remounting on replayKey restarts the pop-in sequence from frame 0.
          key={`marks-${replayKey}`}
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${image.width ?? 1000} ${image.height ?? 1000}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          {geometry.map((g) => (
            // Single small numbered marker, pinned exactly on the feature.
            // No ring/halo: a big circle drawn over the fish is the thing
            // this redesign removed. Framer's default transform-origin is
            // the element's own bounding-box centre, which for a symmetric
            // circle+text pair IS (cx, cy), so the pop-in scales from the
            // marker's own centre with no extra origin bookkeeping.
            <motion.g
              key={`${g.idx}-${g.m.label}`}
              initial={reduce ? false : { opacity: 0, scale: 0 }}
              animate={reduce ? undefined : { opacity: 1, scale: 1 }}
              transition={
                reduce
                  ? undefined
                  : { duration: MARK_POP_S, ease: EASE.enter, delay: markDelay(g.idx) }
              }
            >
              <circle
                cx={g.cx}
                cy={g.cy}
                r={g.badgeR}
                fill="#0f766e"
                stroke="#ffffff"
                strokeWidth={g.badgeStroke}
              />
              <text
                x={g.cx}
                y={g.cy + g.textOffsetY}
                textAnchor="middle"
                fontSize={g.fontSize}
                fontWeight={700}
                fill="#ffffff"
              >
                {g.idx + 1}
              </text>
            </motion.g>
          ))}
        </svg>
      </div>
      <ol
        // Remount with the markers so legend rows re-stagger on replay.
        key={`legend-${replayKey}`}
        className="space-y-1.5 text-[11px] leading-relaxed text-white/85"
      >
        {marks.map((m, idx) => (
          <motion.li
            key={`${idx}-${m.label}`}
            className="flex gap-2"
            // Each legend row fades in in sync with its marker on the photo, so
            // the number you can read there and the number in the list light
            // up together. Reduced motion -> all rows shown at once.
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={
              reduce
                ? undefined
                : { duration: MARK_POP_S, ease: EASE.enter, delay: markDelay(idx) }
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
