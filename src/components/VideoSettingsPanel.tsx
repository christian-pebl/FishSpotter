"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  setVideoSettings,
  useVideoSettings,
  type VideoSpeed,
} from "@/lib/videoSettings";
import { TRANSITION } from "@/lib/motion";

const SPEEDS: VideoSpeed[] = [0.5, 1, 1.5];

/**
 * The live-feed video controls (sound, highlight trace, speed, brightness,
 * contrast), extracted from the old top-right SettingsMenu dropdown so they can
 * live inside the side menu instead of cluttering the feed overlay.
 */
export function VideoSettingsPanel() {
  const [expandedSlider, setExpandedSlider] = useState<"brightness" | "contrast" | null>(null);
  const settings = useVideoSettings();

  return (
    <div>
      <Toggle
        label="Video sound"
        checked={settings.soundOn}
        onChange={(v) => setVideoSettings({ soundOn: v })}
      />
      <Toggle
        label="Highlight trace"
        checked={settings.trace}
        onChange={(v) => setVideoSettings({ trace: v })}
      />

      <div className="mt-3">
        <p className="mb-1 text-[11px] font-medium text-white/65">Playback speed</p>
        <div className="flex gap-1.5">
          {SPEEDS.map((s) => {
            const active = settings.speed === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setVideoSettings({ speed: s })}
                className={`min-h-[40px] flex-1 rounded-modal px-2 py-1.5 text-xs font-semibold transition-colors ${
                  active ? "bg-teal-500 text-navy-900" : "bg-white/10 text-white/75 hover:bg-white/18"
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
        onToggle={() => setExpandedSlider((cur) => (cur === "brightness" ? null : "brightness"))}
        onChange={(v) => setVideoSettings({ brightness: v })}
      />
      <SliderRow
        label="Contrast"
        value={settings.contrast}
        expanded={expandedSlider === "contrast"}
        onToggle={() => setExpandedSlider((cur) => (cur === "contrast" ? null : "contrast"))}
        onChange={(v) => setVideoSettings({ contrast: v })}
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="mt-1 flex min-h-[44px] w-full items-center justify-between rounded-modal px-1.5 py-1.5 text-sm hover:bg-white/5"
    >
      <span className="text-white/85">{label}</span>
      <span
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? "bg-teal-500" : "bg-white/15"
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

function SliderRow({
  label,
  value,
  expanded,
  onToggle,
  onChange,
}: {
  label: string;
  value: number;
  expanded: boolean;
  onToggle: () => void;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex min-h-[44px] w-full items-center justify-between rounded-modal px-1.5 py-1.5 text-sm hover:bg-white/5"
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
            transition={TRANSITION.micro}
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
