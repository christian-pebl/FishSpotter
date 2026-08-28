"use client";

import { useState, useTransition } from "react";
import { FRAMES, getFrame, type FrameId } from "@/lib/cosmetics";
import type { BackdropOption, CrestOption } from "@/lib/cosmetics-service";
import { setBackdrop, setCrest } from "@/app/u/[id]/appearance-actions";

/**
 * Owner-only appearance controls. Shown on your own profile, never on someone
 * else's, because there is nothing here anyone else can act on.
 *
 * The frame is listed but NOT selectable: it is derived from the consensus
 * record, so it reports what you have earned rather than offering a choice. The
 * crest and backdrop are choices among things already unlocked.
 *
 * Optimistic: the select updates locally and the server action re-validates.
 * If the action throws (a stale unlock list, say) the value is rolled back and
 * an inline message explains it, rather than silently keeping a value the
 * server rejected.
 */
export function AppearancePicker({
  frame,
  crest,
  crestOptions,
  backdropSite,
  backdropOptions,
}: {
  frame: FrameId;
  crest: CrestOption | null;
  crestOptions: CrestOption[];
  backdropSite: string | null;
  backdropOptions: BackdropOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [crestValue, setCrestValue] = useState(crest?.scientificName ?? "");
  const [backdropValue, setBackdropValue] = useState(backdropSite ?? "");
  const [error, setError] = useState<string | null>(null);

  const unlockedBackdrops = backdropOptions.filter((o) => o.unlocked);
  const nextBackdrop = backdropOptions
    .filter((o) => !o.unlocked)
    .sort((a, b) => b.answers - a.answers)[0];

  function apply(
    next: string,
    setLocal: (v: string) => void,
    previous: string,
    action: (v: string | null) => Promise<void>,
  ) {
    setLocal(next);
    setError(null);
    startTransition(async () => {
      try {
        await action(next === "" ? null : next);
      } catch {
        setLocal(previous);
        setError("That could not be saved. It may no longer be unlocked.");
      }
    });
  }

  const earned = getFrame(frame);

  return (
    <section className="pebl-surface rounded-card p-6">
      <p className="pebl-eyebrow">Appearance</p>
      <p className="mt-2 text-xs leading-relaxed text-navy-900/55">
        Nothing here is bought. Your frame is earned by what the community
        confirms; your crest and backdrop are chosen from what you have already
        found.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {/* Crest ------------------------------------------------------------ */}
        <div>
          <label
            htmlFor="crest-select"
            className="text-[10px] uppercase tracking-eyebrow text-navy-900/55"
          >
            Crest
          </label>
          {crestOptions.length === 0 ? (
            <p className="mt-1 text-xs text-navy-900/55">
              Unlock a species to choose a crest.
            </p>
          ) : (
            <select
              id="crest-select"
              value={crestValue}
              disabled={pending}
              onChange={(e) =>
                apply(e.target.value, setCrestValue, crestValue, setCrest)
              }
              className="mt-1 min-h-[44px] w-full rounded-modal border border-navy-900/15 bg-surface px-3 text-sm text-navy-900"
            >
              <option value="">No crest</option>
              {crestOptions.map((c) => (
                <option key={c.scientificName} value={c.scientificName}>
                  {c.commonName}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Backdrop --------------------------------------------------------- */}
        <div>
          <label
            htmlFor="backdrop-select"
            className="text-[10px] uppercase tracking-eyebrow text-navy-900/55"
          >
            Backdrop
          </label>
          {unlockedBackdrops.length === 0 ? (
            <p className="mt-1 text-xs text-navy-900/55">
              {nextBackdrop
                ? `Name ${nextBackdrop.target} clips from one site to fly its colours. Closest: ${nextBackdrop.label}, ${nextBackdrop.answers} of ${nextBackdrop.target}.`
                : "Name a few clips from one site to fly its colours."}
            </p>
          ) : (
            <select
              id="backdrop-select"
              value={backdropValue}
              disabled={pending}
              onChange={(e) =>
                apply(e.target.value, setBackdropValue, backdropValue, setBackdrop)
              }
              className="mt-1 min-h-[44px] w-full rounded-modal border border-navy-900/15 bg-surface px-3 text-sm text-navy-900"
            >
              <option value="">No backdrop</option>
              {unlockedBackdrops.map((o) => (
                <option key={o.site} value={o.site}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-xs text-danger">
          {error}
        </p>
      )}

      {/* Frame ladder: status, not a control. */}
      <div className="mt-5">
        <p className="text-[10px] uppercase tracking-eyebrow text-navy-900/55">
          Frame
        </p>
        <p className="mt-1 text-xs text-navy-900/60">
          {frame === "none"
            ? "No frame yet. Frames are earned, not chosen."
            : `You have earned the ${earned.name}. You always wear the best one you hold.`}
        </p>
        <ul className="mt-2 space-y-1">
          {FRAMES.filter((f) => f.id !== "none").map((f) => {
            const held = FRAMES.findIndex((x) => x.id === f.id) <=
              FRAMES.findIndex((x) => x.id === frame);
            return (
              <li
                key={f.id}
                className={`flex items-baseline gap-2 text-[11px] ${
                  held ? "text-navy-900" : "text-navy-900/45"
                }`}
              >
                <span className="font-semibold">{f.name}</span>
                <span>{held ? "earned" : f.requirement}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
