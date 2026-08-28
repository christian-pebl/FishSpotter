"use client";

import { useEffect, useState } from "react";

export type VideoSpeed = 0.25 | 0.5 | 0.75 | 1 | 1.5 | 2;

/**
 * The playback-rate ladder, ascending. Ordered because the on-clip +/- stepper
 * walks it one rung at a time, and 1 must stay a member so "normal speed" is
 * reachable from both directions.
 *
 * The slow end matters more than the fast end here: a goby darting across frame
 * is unreadable at 1x and legible at 0.25x, which is the whole point of putting
 * the control on the clip rather than only in the side menu.
 */
export const VIDEO_SPEEDS: readonly VideoSpeed[] = [0.25, 0.5, 0.75, 1, 1.5, 2];

export interface VideoSettings {
  soundOn: boolean;
  trace: boolean;
  speed: VideoSpeed;
  brightness: number; // -5..5
  contrast: number;   // -5..5
}

const DEFAULTS: VideoSettings = {
  soundOn: false,
  trace: false,
  speed: 1,
  // Murky underwater footage reads better with a gentle default lift; users can
  // still dial it back to 0 (or up) in the settings menu (persisted per-device).
  brightness: 1,
  contrast: 1,
};

const STORAGE_KEY = "fishspotter:videoSettings";
const EVENT_NAME = "fishspotter:videoSettingsChanged";

function clampStep(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(-5, Math.min(5, Math.round(v)));
}

function normalizeSpeed(v: unknown): VideoSpeed {
  return VIDEO_SPEEDS.includes(v as VideoSpeed) ? (v as VideoSpeed) : 1;
}

/**
 * One press of the on-clip speed stepper: the next rung up (+1) or down (-1).
 *
 * Clamped at both ends rather than wrapped, because wrapping from 2x straight
 * back to 0.25x on one press is a nasty surprise mid-clip. A press at the limit
 * is simply a no-op, and the button that would do it is disabled anyway.
 */
export function stepSpeed(current: VideoSpeed, direction: 1 | -1): VideoSpeed {
  const at = VIDEO_SPEEDS.indexOf(current);
  const next = (at === -1 ? VIDEO_SPEEDS.indexOf(1) : at) + direction;
  return VIDEO_SPEEDS[Math.max(0, Math.min(VIDEO_SPEEDS.length - 1, next))];
}

function read(): VideoSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<VideoSettings>;
    return {
      soundOn: typeof parsed.soundOn === "boolean" ? parsed.soundOn : DEFAULTS.soundOn,
      trace: typeof parsed.trace === "boolean" ? parsed.trace : DEFAULTS.trace,
      speed: normalizeSpeed(parsed.speed),
      brightness: clampStep(Number(parsed.brightness ?? 0)),
      contrast: clampStep(Number(parsed.contrast ?? 0)),
    };
  } catch {
    return DEFAULTS;
  }
}

function write(next: VideoSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
  window.dispatchEvent(new CustomEvent<VideoSettings>(EVENT_NAME, { detail: next }));
}

export function getVideoSettings(): VideoSettings {
  return read();
}

export function setVideoSettings(patch: Partial<VideoSettings>) {
  const current = read();
  const next: VideoSettings = {
    ...current,
    ...patch,
    brightness:
      patch.brightness !== undefined ? clampStep(patch.brightness) : current.brightness,
    contrast:
      patch.contrast !== undefined ? clampStep(patch.contrast) : current.contrast,
    speed: patch.speed !== undefined ? normalizeSpeed(patch.speed) : current.speed,
  };
  write(next);
}

export function useVideoSettings(): VideoSettings {
  // Start with defaults to avoid SSR/client mismatch; hydrate from storage after mount.
  const [settings, setSettings] = useState<VideoSettings>(DEFAULTS);

  useEffect(() => {
    setSettings(read());
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<VideoSettings>).detail;
      if (detail) setSettings(detail);
      else setSettings(read());
    };
    window.addEventListener(EVENT_NAME, onChange);
    // also listen to storage events from other tabs
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setSettings(read());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return settings;
}

export function videoFilterFor(settings: VideoSettings): string {
  // 1 step = 8% adjustment; range yields ~0.6..1.4
  const b = 1 + settings.brightness * 0.08;
  const c = 1 + settings.contrast * 0.08;
  if (b === 1 && c === 1) return "none";
  return `brightness(${b.toFixed(2)}) contrast(${c.toFixed(2)})`;
}
