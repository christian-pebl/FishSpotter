"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type BBox = {
  frame_clip: number;
  x_norm: number;
  w_norm: number;
};

const PORTRAIT_ZOOM = 1.15;
const MAX_SHIFT_PERCENT = 14;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getNearestBBox(frame: number, bboxes: BBox[]) {
  if (bboxes.length === 0) return null;

  let low = 0;
  let high = bboxes.length - 1;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (bboxes[mid].frame_clip < frame) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  const candidate = bboxes[low];
  const previous = bboxes[Math.max(0, low - 1)];

  if (!previous) return candidate;

  return Math.abs(previous.frame_clip - frame) < Math.abs(candidate.frame_clip - frame)
    ? previous
    : candidate;
}

export function usePortraitFishPan(bboxes: BBox[] | null) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPortrait, setIsPortrait] = useState(false);
  const [translateX, setTranslateX] = useState(0);

  const sortedBBoxes = useMemo(() => {
    if (!bboxes?.length) return [];
    return [...bboxes].sort((a, b) => a.frame_clip - b.frame_clip);
  }, [bboxes]);

  useEffect(() => {
    const updateOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };

    updateOrientation();
    window.addEventListener("resize", updateOrientation);

    return () => window.removeEventListener("resize", updateOrientation);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isPortrait || sortedBBoxes.length === 0) {
      setTranslateX(0);
      return;
    }

    const maxFrame = sortedBBoxes[sortedBBoxes.length - 1]?.frame_clip ?? 0;
    let frameId = 0;

    const syncPan = () => {
      if (!video.duration || maxFrame <= 0) return;

      const currentFrame = (video.currentTime / video.duration) * maxFrame;
      const bbox = getNearestBBox(currentFrame, sortedBBoxes);
      if (!bbox) return;

      const fishCenterX = bbox.x_norm + bbox.w_norm / 2;
      const targetTranslate = clamp((0.5 - fishCenterX) * 28, -MAX_SHIFT_PERCENT, MAX_SHIFT_PERCENT);

      setTranslateX((current) =>
        Math.abs(current - targetTranslate) < 0.15
          ? current
          : current + (targetTranslate - current) * 0.22
      );
    };

    const tick = () => {
      syncPan();
      if (!video.paused && !video.ended) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    const start = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(tick);
    };

    const stop = () => {
      window.cancelAnimationFrame(frameId);
    };

    video.addEventListener("loadedmetadata", syncPan);
    video.addEventListener("play", start);
    video.addEventListener("pause", stop);
    video.addEventListener("seeking", start);
    video.addEventListener("ended", stop);

    syncPan();
    if (!video.paused) start();

    return () => {
      stop();
      video.removeEventListener("loadedmetadata", syncPan);
      video.removeEventListener("play", start);
      video.removeEventListener("pause", stop);
      video.removeEventListener("seeking", start);
      video.removeEventListener("ended", stop);
    };
  }, [isPortrait, sortedBBoxes]);

  const panEnabled = isPortrait && sortedBBoxes.length > 0;
  const videoStyle = panEnabled
    ? {
        transform: `translate3d(${translateX}%, 0, 0) scale(${PORTRAIT_ZOOM})`,
        transition: "transform 120ms linear",
        transformOrigin: "center center",
      }
    : undefined;

  return { videoRef, videoStyle, panEnabled };
}
