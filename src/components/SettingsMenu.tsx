"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  setVideoSettings,
  useVideoSettings,
  type VideoSpeed,
} from "@/lib/videoSettings";

const SPEEDS: VideoSpeed[] = [0.5, 1, 1.5];

export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [expandedSlider, setExpandedSlider] = useState<"brightness" | "contrast" | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const settings = useVideoSettings();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-label="Settings"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-white/90 hover:bg-white/10"
        style={{ textShadow: "0 1px 3px rgba(0,0,0,0.55)" }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="menu"
            initial={reduceMotion ? false : { opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            role="dialog"
            aria-label="Video settings"
            className="absolute right-0 top-full z-50 mt-2 w-72 origin-top-right rounded-2xl border border-white/12 bg-[#17252A]/92 p-3 text-white shadow-[0_10px_36px_rgba(0,0,0,0.55)] backdrop-blur-md"
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
              Settings
            </p>

            <Toggle
              label="Sound"
              checked={settings.soundOn}
              onChange={(v) => setVideoSettings({ soundOn: v })}
            />
            <Toggle
              label="Highlight trace"
              checked={settings.trace}
              onChange={(v) => setVideoSettings({ trace: v })}
            />

            <div className="mt-3">
              <p className="mb-1 text-[11px] font-medium text-white/65">Speed</p>
              <div className="flex gap-1.5">
                {SPEEDS.map((s) => {
                  const active = settings.speed === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setVideoSettings({ speed: s })}
                      className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
                        active
                          ? "bg-[#3AAFA9] text-[#17252A]"
                          : "bg-white/10 text-white/75 hover:bg-white/18"
                      }`}
                      aria-pressed={active}
                    >
                      {s}×
                    </button>
                  );
                })}
              </div>
            </div>

            <SliderRow
              label="Brightness"
              value={settings.brightness}
              expanded={expandedSlider === "brightness"}
              onToggle={() =>
                setExpandedSlider((cur) => (cur === "brightness" ? null : "brightness"))
              }
              onChange={(v) => setVideoSettings({ brightness: v })}
            />
            <SliderRow
              label="Contrast"
              value={settings.contrast}
              expanded={expandedSlider === "contrast"}
              onToggle={() =>
                setExpandedSlider((cur) => (cur === "contrast" ? null : "contrast"))
              }
              onChange={(v) => setVideoSettings({ contrast: v })}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}
function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="mt-1 flex w-full items-center justify-between rounded-lg px-1.5 py-1.5 text-sm hover:bg-white/5"
    >
      <span className="text-white/85">{label}</span>
      <span
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? "bg-[#3AAFA9]" : "bg-white/15"
        }`}
      >
        <span
          className="absolute h-4 w-4 rounded-full bg-white shadow transition-transform"
          style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }}
        />
      </span>
    </button>
  );
}

interface SliderRowProps {
  label: string;
  value: number;
  expanded: boolean;
  onToggle: () => void;
  onChange: (v: number) => void;
}
function SliderRow({ label, value, expanded, onToggle, onChange }: SliderRowProps) {
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between rounded-lg px-1.5 py-1.5 text-sm hover:bg-white/5"
      >
        <span className="text-white/85">{label}</span>
        <span className="flex items-center gap-2">
          <span className="tabular-nums text-xs text-white/55">
            {value > 0 ? `+${value}` : value}
          </span>
          <svg
            width="11"
            height="11"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            style={{ transform: expanded ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }}
          >
            <path
              d="M3 4.5L6 7.5L9 4.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-white/55"
            />
          </svg>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="slider"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden px-1.5"
          >
            <input
              type="range"
              min={-5}
              max={5}
              step={1}
              value={value}
              onChange={(e) => onChange(Number(e.target.value))}
              aria-label={label}
              className="fs-range mt-2 w-full"
            />
            <div className="mt-1 flex justify-between text-[10px] text-white/40">
              <span>-5</span>
              <span>0</span>
              <span>+5</span>
            </div>
            {value !== 0 && (
              <button
                type="button"
                onClick={() => onChange(0)}
                className="mt-1 text-[10px] uppercase tracking-wider text-white/55 hover:text-white/85"
              >
                Reset
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
