"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { saveSnippetTrack, type TrackFrame } from "./actions";

// Nominal frame rate used to turn a playback time into a frame_clip index.
// The feed renderer maps playback progress -> frame *proportionally* across the
// first..last frame_clip, so the exact value is immaterial to alignment as long
// as it is consistent; 30 keeps the numbers frame-like.
const FPS = 30;
// A box smaller than this (in normalised units) is treated as an accidental
// click, not a deliberate box.
const MIN_BOX = 0.01;

type Rect = { left: number; top: number; width: number; height: number };
type DrawState = { x0: number; y0: number; x1: number; y1: number } | null;

function containRect(cw: number, ch: number, vw: number, vh: number): Rect {
  if (!vw || !vh || !cw || !ch) return { left: 0, top: 0, width: cw, height: ch };
  const scale = Math.min(cw / vw, ch / vh);
  const width = vw * scale;
  const height = vh * scale;
  return { left: (cw - width) / 2, top: (ch - height) / 2, width, height };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function fmtTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00.0";
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

// Box at a given frame, interpolating between surrounding keyframes — mirrors
// how the feed draws the trail so the editor preview matches the live render.
function boxAtFrame(frames: TrackFrame[], frame: number): TrackFrame | null {
  if (frames.length === 0) return null;
  if (frame <= frames[0].frame_clip) return frames[0];
  const last = frames[frames.length - 1];
  if (frame >= last.frame_clip) return last;
  const upper = frames.findIndex((f) => f.frame_clip >= frame);
  if (upper <= 0) return frames[0];
  const a = frames[upper - 1];
  const b = frames[upper];
  const span = b.frame_clip - a.frame_clip;
  const t = span > 0 ? (frame - a.frame_clip) / span : 0;
  const mix = (x: number, y: number) => x + (y - x) * t;
  return {
    frame_clip: frame,
    x_norm: mix(a.x_norm, b.x_norm),
    y_norm: mix(a.y_norm, b.y_norm),
    w_norm: mix(a.w_norm, b.w_norm),
    h_norm: mix(a.h_norm, b.h_norm),
  };
}

export function SnippetTrackEditor({
  snippetId,
  videoUrl,
  thumbnailUrl,
  initialFrames,
}: {
  snippetId: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  initialFrames: TrackFrame[];
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [frames, setFrames] = useState<TrackFrame[]>(
    [...initialFrames].sort((a, b) => a.frame_clip - b.frame_clip),
  );
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rect, setRect] = useState<Rect>({ left: 0, top: 0, width: 0, height: 0 });
  const [aspect, setAspect] = useState("3 / 4");
  const [draw, setDraw] = useState<DrawState>(null);
  // On touch, the draw surface only captures gestures (and blocks page scroll)
  // while draw mode is on; otherwise a swipe over the video scrolls the page as
  // normal. A mouse/pen can always draw regardless of this.
  const [drawMode, setDrawMode] = useState(false);

  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const currentFrame = Math.round(currentTime * FPS);

  // Recompute the contained video rect on resize + once metadata is known.
  const recomputeRect = useCallback(() => {
    const wrap = wrapperRef.current;
    const video = videoRef.current;
    if (!wrap || !video) return;
    setRect(
      containRect(wrap.clientWidth, wrap.clientHeight, video.videoWidth, video.videoHeight),
    );
  }, []);

  useLayoutEffect(() => {
    recomputeRect();
    const wrap = wrapperRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(recomputeRect);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [recomputeRect]);

  // Keep currentTime/duration/playing in sync with the element.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    const onMeta = () => {
      setDuration(v.duration || 0);
      // Size the drawing box to the clip's real shape so a landscape clip isn't
      // squeezed into a tall frame (which shrinks the fish and wastes area).
      if (v.videoWidth && v.videoHeight) setAspect(`${v.videoWidth} / ${v.videoHeight}`);
      recomputeRect();
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [recomputeRect]);

  const seek = useCallback((t: number) => {
    const v = videoRef.current;
    if (!v) return;
    const clamped = Math.max(0, Math.min(v.duration || 0, t));
    v.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }, []);

  // --- Drawing on the overlay -------------------------------------------------
  const toNorm = useCallback(
    (clientX: number, clientY: number) => {
      const svg = wrapperRef.current?.querySelector("svg")?.getBoundingClientRect();
      if (!svg || svg.width === 0) return { x: 0, y: 0 };
      return {
        x: clamp01((clientX - svg.left) / svg.width),
        y: clamp01((clientY - svg.top) / svg.height),
      };
    },
    [],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      // Let touch swipes scroll the page unless the user has turned on draw
      // mode. Mouse/pen always draws.
      if (e.pointerType === "touch" && !drawMode) return;
      e.preventDefault();
      videoRef.current?.pause();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      const { x, y } = toNorm(e.clientX, e.clientY);
      setDraw({ x0: x, y0: y, x1: x, y1: y });
    },
    [toNorm, drawMode],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      setDraw((d) => {
        if (!d) return d;
        const { x, y } = toNorm(e.clientX, e.clientY);
        return { ...d, x1: x, y1: y };
      });
    },
    [toNorm],
  );

  const commitDraw = useCallback(
    (d: NonNullable<DrawState>) => {
      const x = Math.min(d.x0, d.x1);
      const y = Math.min(d.y0, d.y1);
      const w = Math.abs(d.x1 - d.x0);
      const h = Math.abs(d.y1 - d.y0);
      if (w < MIN_BOX || h < MIN_BOX) return; // ignore stray click
      const frame_clip = currentFrame;
      const box: TrackFrame = { frame_clip, x_norm: x, y_norm: y, w_norm: w, h_norm: h };
      setFrames((prev) => {
        const next = prev.filter((f) => f.frame_clip !== frame_clip);
        next.push(box);
        next.sort((a, b) => a.frame_clip - b.frame_clip);
        return next;
      });
      setDirty(true);
      setMessage(null);
    },
    [currentFrame],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
      setDraw((d) => {
        if (d) commitDraw(d);
        return null;
      });
    },
    [commitDraw],
  );

  const deleteFrame = useCallback((frame_clip: number) => {
    setFrames((prev) => prev.filter((f) => f.frame_clip !== frame_clip));
    setDirty(true);
    setMessage(null);
  }, []);

  const clearAll = useCallback(() => {
    if (frames.length && !confirm("Remove every keyframe from this clip's track?")) return;
    setFrames([]);
    setDirty(true);
    setMessage(null);
  }, [frames.length]);

  const save = useCallback(() => {
    setError(null);
    setMessage(null);
    // Anchor the track to t=0 and the clip end so the feed's proportional
    // progress->frame mapping lines the boxes up with real playback time.
    const sorted = [...frames].sort((a, b) => a.frame_clip - b.frame_clip);
    const out = [...sorted];
    if (sorted.length) {
      const lastFrame = duration ? Math.round(duration * FPS) : sorted[sorted.length - 1].frame_clip;
      if (sorted[0].frame_clip > 0) out.unshift({ ...sorted[0], frame_clip: 0 });
      if (sorted[sorted.length - 1].frame_clip < lastFrame) {
        out.push({ ...sorted[sorted.length - 1], frame_clip: lastFrame });
      }
    }
    startTransition(async () => {
      try {
        const res = await saveSnippetTrack(snippetId, out);
        setMessage(`Saved — ${res.frames} frame(s) written to the track.`);
        setDirty(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }, [frames, duration, snippetId]);

  // --- Preview geometry (pixel space within the contained rect) ---------------
  const preview = useMemo(() => boxAtFrame(frames, currentFrame), [frames, currentFrame]);
  const exact = frames.find((f) => f.frame_clip === currentFrame) ?? null;
  const px = (n: number) => n * rect.width;
  const py = (n: number) => n * rect.height;
  const centers = frames.map((f) => ({
    cx: px(f.x_norm + f.w_norm / 2),
    cy: py(f.y_norm + f.h_norm / 2),
    f,
  }));

  return (
    <section className="rounded-lg border border-navy-200/60 bg-white p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-navy-500">
          Fish tracking
        </p>
        <p className="text-[11px] text-navy-500">
          {frames.length} keyframe{frames.length === 1 ? "" : "s"}
          {dirty ? " · unsaved" : ""}
        </p>
      </div>
      <p className="mt-1 text-[11px] text-navy-500">
        Scrub to where the creature is, then drag a box around it to drop a keyframe. Add a few
        across the clip — the feed draws a smooth trail between them. On a phone, turn on{" "}
        <span className="font-medium text-navy-700">Draw on clip</span> first (otherwise swiping the
        clip just scrolls the page).
      </p>

      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,360px)_1fr]">
        {/* Video + draw overlay */}
        <div>
          <button
            type="button"
            onClick={() => setDrawMode((v) => !v)}
            aria-pressed={drawMode}
            className={`mb-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold transition lg:hidden ${
              drawMode
                ? "bg-teal-600 text-white hover:bg-teal-700"
                : "border border-teal-600 text-teal-700 hover:bg-teal-50"
            }`}
          >
            {drawMode ? "Done drawing — scroll the page" : "Draw on clip"}
          </button>
          <div
            ref={wrapperRef}
            className={`relative mx-auto w-full overflow-hidden rounded-lg bg-navy-900 ${
              drawMode ? "ring-2 ring-teal-500" : ""
            }`}
            style={{ aspectRatio: aspect, maxHeight: "min(68vh, 560px)" }}
          >
            <video
              ref={videoRef}
              src={videoUrl}
              poster={thumbnailUrl ?? undefined}
              playsInline
              preload="metadata"
              className="absolute inset-0 h-full w-full object-contain"
            />
            <div
              className="absolute"
              style={{
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
                // Only swallow touch gestures (blocking page scroll) while
                // drawing on a phone; a mouse/pen ignores touch-action anyway.
                touchAction: drawMode ? "none" : "auto",
              }}
            >
              <svg
                width={rect.width}
                height={rect.height}
                className="block cursor-crosshair"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              >
                {/* trail between keyframe centres */}
                {centers.length > 1 && (
                  <polyline
                    points={centers.map((c) => `${c.cx},${c.cy}`).join(" ")}
                    fill="none"
                    stroke="#3AAFA9"
                    strokeWidth={1.5}
                    strokeOpacity={0.5}
                    strokeDasharray="4 4"
                  />
                )}
                {/* every keyframe centre */}
                {centers.map((c) => (
                  <circle
                    key={c.f.frame_clip}
                    cx={c.cx}
                    cy={c.cy}
                    r={c.f.frame_clip === currentFrame ? 5 : 3}
                    fill={c.f.frame_clip === currentFrame ? "#3AAFA9" : "#ffffff"}
                    stroke="#3AAFA9"
                    strokeWidth={1.5}
                  />
                ))}
                {/* interpolated box at the current time (where the trail head sits) */}
                {preview && !draw && (
                  <rect
                    x={px(preview.x_norm)}
                    y={py(preview.y_norm)}
                    width={px(preview.w_norm)}
                    height={py(preview.h_norm)}
                    fill="none"
                    stroke={exact ? "#3AAFA9" : "#ffffff"}
                    strokeWidth={2}
                    strokeOpacity={exact ? 1 : 0.7}
                    strokeDasharray={exact ? undefined : "5 4"}
                  />
                )}
                {/* live draft while dragging */}
                {draw && (
                  <rect
                    x={px(Math.min(draw.x0, draw.x1))}
                    y={py(Math.min(draw.y0, draw.y1))}
                    width={px(Math.abs(draw.x1 - draw.x0))}
                    height={py(Math.abs(draw.y1 - draw.y0))}
                    fill="#3AAFA9"
                    fillOpacity={0.15}
                    stroke="#3AAFA9"
                    strokeWidth={2}
                  />
                )}
              </svg>
            </div>
          </div>

          {/* Transport — 44px tall controls for thumbs */}
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-md bg-navy-900 text-sm font-medium text-white hover:bg-navy-800"
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              onClick={() => seek(currentTime - 1 / FPS)}
              className="inline-flex h-11 items-center justify-center rounded-md border border-navy-200 px-3 text-sm text-navy-700 hover:bg-navy-50"
            >
              &minus;1f
            </button>
            <button
              type="button"
              onClick={() => seek(currentTime + 1 / FPS)}
              className="inline-flex h-11 items-center justify-center rounded-md border border-navy-200 px-3 text-sm text-navy-700 hover:bg-navy-50"
            >
              +1f
            </button>
          </div>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.01}
            value={currentTime}
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="mt-3 h-11 w-full accent-teal-600"
            aria-label="Scrub clip"
          />
          <p className="mt-1 text-center tabular-nums text-[11px] text-navy-500">
            {fmtTime(currentTime)} / {fmtTime(duration)}
          </p>
        </div>

        {/* Keyframe list + actions */}
        <div className="min-w-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={save}
              disabled={!dirty || pending}
              className="inline-flex h-11 items-center justify-center rounded-md bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 sm:order-last"
            >
              {pending ? "Saving…" : dirty ? "Save track" : "Saved"}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => exact && deleteFrame(currentFrame)}
                disabled={!exact}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-md border border-navy-200 px-3 text-sm font-medium text-navy-700 hover:bg-navy-50 disabled:opacity-40"
              >
                Delete here
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={frames.length === 0}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-md border border-navy-200 px-3 text-sm font-medium text-navy-700 hover:bg-navy-50 disabled:opacity-40"
              >
                Clear all
              </button>
            </div>
          </div>

          {message && <p className="mt-2 text-[12px] text-teal-700">{message}</p>}
          {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}

          <ul className="mt-3 max-h-[320px] divide-y divide-navy-100 overflow-y-auto rounded-md border border-navy-100">
            {frames.length === 0 && (
              <li className="px-3 py-3 text-[12px] text-navy-500">
                No keyframes yet. Drag a box on the video to add the first one.
              </li>
            )}
            {frames.map((f) => {
              const isCurrent = f.frame_clip === currentFrame;
              return (
                <li
                  key={f.frame_clip}
                  className={`flex items-center justify-between gap-2 text-[12px] ${
                    isCurrent ? "bg-teal-50" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => seek(f.frame_clip / FPS)}
                    className="flex min-h-[44px] flex-1 items-center gap-2 px-3 py-2 text-left text-navy-800 hover:text-teal-700"
                  >
                    <span className="tabular-nums font-medium">{fmtTime(f.frame_clip / FPS)}</span>
                    <span className="text-navy-400">
                      {Math.round(f.x_norm * 100)},{Math.round(f.y_norm * 100)} ·{" "}
                      {Math.round(f.w_norm * 100)}×{Math.round(f.h_norm * 100)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteFrame(f.frame_clip)}
                    className="inline-flex min-h-[44px] shrink-0 items-center px-3 text-[11px] font-medium text-navy-400 hover:bg-red-50 hover:text-red-600"
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
