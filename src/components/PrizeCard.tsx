"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import { onPebbles } from "@/lib/pebble-bus";
import {
  PRIZE_BLURB,
  PRIZE_FALLBACK_IMAGE,
  PRIZE_GALLERY,
  PRIZE_NAME,
  PRIZE_TARGET_PEBBLES,
} from "@/lib/prize";
import { EASE, TRANSITION } from "@/lib/motion";

/** A small outline pebble (matches the Pebble bag glyph). */
function PebbleGlyph({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.6" y="4.2" width="12.8" height="7.6" rx="3.8" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/** Eases toward `value` (instant under reduced motion). */
function AnimatedCount({ value }: { value: number }) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (reduceMotion || from === value) {
      setDisplay(value);
      return;
    }
    const controls = animate(from, value, {
      duration: 0.5,
      ease: EASE.enter,
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, reduceMotion]);
  return <>{display.toLocaleString()}</>;
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d={dir === "left" ? "M10 3L5 8l5 5" : "M6 3l5 5-5 5"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Flick-through gallery of the guide: front cover first, then inside pages.
 * Every manifest entry is probed by the thumbnail strip on mount — a file
 * that 404s drops out, and if none load at all the strip collapses and the
 * committed PEBL illustration takes over. So shipping real screenshots is
 * just dropping files into public/shop/guide/ (see PRIZE_GALLERY).
 */
function PrizeGallery({ reduceMotion }: { reduceMotion: boolean }) {
  // Per-slot candidate index, keyed by the slot's first source. An onError
  // advances the slot to its next candidate (jpg -> png); once the index
  // walks past the last candidate the slot has no loadable file and drops.
  const [candidate, setCandidate] = useState<Record<string, number>>({});
  const [active, setActive] = useState(0);

  const loaded = PRIZE_GALLERY.filter(
    (slot) => (candidate[slot.srcs[0]] ?? 0) < slot.srcs.length,
  ).map((slot) => ({
    key: slot.srcs[0],
    src: slot.srcs[candidate[slot.srcs[0]] ?? 0],
    alt: slot.alt,
  }));
  const visible =
    loaded.length > 0
      ? loaded
      : [{ key: PRIZE_FALLBACK_IMAGE.src, ...PRIZE_FALLBACK_IMAGE }];
  const idx = Math.min(active, visible.length - 1);
  const current = visible[idx];
  const many = visible.length > 1;

  const markFailed = (key: string) =>
    setCandidate((c) => ({ ...c, [key]: (c[key] ?? 0) + 1 }));

  return (
    <div className="flex flex-col gap-2">
      <div className="relative flex items-center justify-center overflow-hidden rounded-modal bg-[color:var(--surface-muted)] p-2">
        <AnimatePresence mode="wait" initial={false}>
          {/* Plain img (not next/image): sources fall back at runtime via
              onError, and the assets are small local files. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <motion.img
            key={current.src}
            src={current.src}
            onError={() => markFailed(current.key)}
            alt={current.alt}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : TRANSITION.micro}
            className="h-44 w-full object-contain sm:h-52"
          />
        </AnimatePresence>
        {many && (
          <>
            <button
              type="button"
              aria-label="Previous page"
              onClick={() => setActive((idx - 1 + visible.length) % visible.length)}
              className="absolute left-1.5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-navy-900/40 text-white hover:bg-navy-900/60"
            >
              <Chevron dir="left" />
            </button>
            <button
              type="button"
              aria-label="Next page"
              onClick={() => setActive((idx + 1) % visible.length)}
              className="absolute right-1.5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-navy-900/40 text-white hover:bg-navy-900/60"
            >
              <Chevron dir="right" />
            </button>
          </>
        )}
      </div>

      {many && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="tablist" aria-label="Guide pages">
          {visible.map((img, i) => (
            <button
              key={img.key}
              type="button"
              role="tab"
              aria-selected={i === idx}
              aria-label={`Show ${img.alt}`}
              onClick={() => setActive(i)}
              className={`h-14 w-12 shrink-0 overflow-hidden rounded-modal border-2 bg-[color:var(--surface-muted)] transition-colors ${
                i === idx ? "border-teal-500" : "border-transparent hover:border-navy-900/20"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.src}
                onError={() => markFailed(img.key)}
                alt=""
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type Note = { kind: "error" | "success"; text: string };

/**
 * The single goal of the Pebbles page: your progress toward winning the
 * Seasearch guide, and the claim action once you're there. The prize is a
 * gift (claiming deducts nothing); POST /api/prize/claim enforces the target
 * + the anti-gaming eligibility gate server-side — `eligibility` here is the
 * precomputed copy so the card can pre-warn instead of surprising a spotter
 * at 1,000 Pebbles.
 *
 * Imagery is a flick-through gallery (front cover + inside pages) driven by
 * the PRIZE_GALLERY manifest — drop screenshots into public/shop/guide/ with
 * the manifest filenames and they appear with no code change; until then the
 * committed PEBL illustration stands in.
 */
export function PrizeCard({
  authed,
  initialEarned,
  initiallyClaimed,
  eligibility,
}: {
  authed: boolean;
  initialEarned: number;
  initiallyClaimed: boolean;
  /** Precomputed for signed-in spotters; null for guests. */
  eligibility: { eligible: boolean; reason: string | null } | null;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const [earned, setEarned] = useState(initialEarned);
  const [claimed, setClaimed] = useState(initiallyClaimed);
  const [justClaimed, setJustClaimed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const [shake, setShake] = useState(0);

  // Keep the progress live while the page is open (earning in another tab of
  // the same session fires the pebble bus).
  useEffect(
    () => onPebbles(({ earned: delta }) => setEarned((e) => e + delta)),
    [],
  );

  const reached = earned >= PRIZE_TARGET_PEBBLES;
  const pct = Math.max(0, Math.min(100, (earned / PRIZE_TARGET_PEBBLES) * 100));
  const gated = reached && !claimed && !!eligibility && !eligibility.eligible;

  async function claim() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/prize/claim", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setShake((s) => s + 1);
        setNote({ kind: "error", text: data.error ?? "Something went wrong. Try again." });
        return;
      }
      setClaimed(true);
      setJustClaimed(true);
      setNote({ kind: "success", text: "Claimed! PEBL will email you to arrange delivery." });
    } catch {
      setShake((s) => s + 1);
      setNote({ kind: "error", text: "Network error. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={TRANSITION.standard}
      className="pebl-surface rounded-card p-4 shadow-chip sm:p-5"
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-center">
        <motion.div
          key={justClaimed ? 1 : 0}
          initial={false}
          animate={justClaimed && !reduceMotion ? { scale: [1, 1.04, 1] } : { scale: 1 }}
          transition={{ duration: 0.45, ease: EASE.enter }}
        >
          <PrizeGallery reduceMotion={reduceMotion} />
        </motion.div>

        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-eyebrow text-teal-600">
              The prize
            </p>
            <h2 className="mt-1 font-brand text-h3 text-navy-900">Win the {PRIZE_NAME}</h2>
            <p className="mt-1.5 text-sm leading-6 text-navy-900/72">{PRIZE_BLURB}</p>
          </div>

          <motion.div
            key={shake}
            initial={false}
            animate={shake && !reduceMotion ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col gap-2"
          >
            {authed ? (
              <>
                <div>
                  <div
                    aria-hidden="true"
                    className="h-2 w-full overflow-hidden rounded-full bg-navy-900/10"
                  >
                    <motion.div
                      className="h-full rounded-full bg-teal-500"
                      initial={false}
                      animate={{ width: `${pct}%` }}
                      transition={reduceMotion ? { duration: 0 } : TRANSITION.layout}
                    />
                  </div>
                  <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-navy-900/72">
                    <span className="text-teal-700">
                      <PebbleGlyph size={12} />
                    </span>
                    <span className="tabular-nums">
                      <AnimatedCount value={Math.min(earned, PRIZE_TARGET_PEBBLES)} /> of{" "}
                      {PRIZE_TARGET_PEBBLES.toLocaleString()}
                    </span>
                    {!reached && <span>— keep spotting</span>}
                  </p>
                </div>

                {claimed ? (
                  <span className="inline-flex min-h-[44px] items-center justify-center gap-1.5 self-start rounded-full bg-teal-500/12 px-5 text-sm font-semibold text-teal-700">
                    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden="true">
                      <motion.path
                        d="M2 6.5l2.5 2.5L10 3"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={justClaimed && !reduceMotion ? { pathLength: 0 } : false}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.4, ease: EASE.enter, delay: 0.05 }}
                      />
                    </svg>
                    Claimed
                  </span>
                ) : reached ? (
                  <motion.button
                    type="button"
                    onClick={claim}
                    disabled={busy || gated}
                    whileTap={reduceMotion || busy || gated ? undefined : { scale: 0.97 }}
                    className="inline-flex min-h-[44px] items-center justify-center self-start rounded-full bg-teal-600 px-6 text-sm font-semibold text-white transition-opacity hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {busy ? "Claiming…" : "Claim your guide"}
                  </motion.button>
                ) : null}

                {gated && !note && (
                  <p className="text-xs text-navy-900/72" role="status">
                    {eligibility?.reason}
                  </p>
                )}
              </>
            ) : (
              <Link
                href="/auth/signin"
                className="inline-flex min-h-[44px] items-center justify-center self-start rounded-full bg-teal-600 px-5 text-sm font-semibold text-white hover:bg-teal-700"
              >
                Sign in and start earning
              </Link>
            )}

            <AnimatePresence mode="wait" initial={false}>
              {note && (
                <motion.p
                  key={note.text}
                  initial={{ opacity: 0, y: -3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={TRANSITION.micro}
                  className={`text-xs ${note.kind === "error" ? "text-danger" : "text-teal-700"}`}
                  role={note.kind === "error" ? "alert" : "status"}
                >
                  {note.text}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}
