"use client";

import { setVideoSettings, useVideoSettings } from "@/lib/videoSettings";

/**
 * The side menu's live-video controls: the highlight trace.
 *
 * Speed, brightness and contrast used to live here too. They moved onto the
 * clip's own control stack (see FeedCard) because all three correct what you
 * are looking at, and judging a correction means seeing the picture while you
 * make it. A drawer that covers the clip is the one place they cannot work.
 * The trace survives because it is a preference, not a correction: you set it
 * once and it is as easy to judge with the menu open as shut.
 *
 * Video sound was removed on 30 Aug 2026. The clips carry no audio worth
 * hearing (a camera on a mooring), and every one played muted by default, so
 * the toggle only ever offered a worse version of the same clip.
 */
export function VideoSettingsPanel() {
  const settings = useVideoSettings();

  return (
    <div>
      <Toggle
        label="Highlight trace"
        checked={settings.trace}
        onChange={(v) => setVideoSettings({ trace: v })}
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
