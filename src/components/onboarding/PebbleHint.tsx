"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { DURATION, EASE } from "@/lib/motion";
import { useAnchorRect } from "./useAnchorRect";

const SEEN_KEY = "fishspotter:pebbleHintSeen";
const AUTO_HIDE_MS = 8000;

/**
 * The pebbles coda: a hint, not a step.
 *
 * The tour ends at the community consensus. This appears AFTER it is already
 * complete and the completion has been recorded, so a user who ignores it has
 * still finished onboarding and will never be shown the tutorial again. That is
 * the whole reason it is not a seventh step: explaining the currency is worth
 * one line, not a gate between the user and their feed.
 *
 * Non-blocking by construction: no dim, no spotlight, no focus move, and
 * `pointer-events` only on the callout itself. The feed stays fully usable
 * behind it, and it lands on a control the user has just watched animate (the
 * pebbles fly into the bag on commit via pebble-bus), so it reads as a label on
 * something that just happened rather than an interruption.
 */
export function PebbleHint({
  earned,
  onDismiss,
}: {
  earned: number;
  onDismiss: () => void;
}) {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(false);
  const match = useAnchorRect(["pebbles"], show);

  // `onDismiss` is a fresh closure on every parent render, so it must not be an
  // effect dependency here. It was, and the bug that caused was quietly fatal:
  // the mount effect wrote the "seen" flag, the parent re-rendered, the effect
  // re-ran with a new `onDismiss`, read back the flag it had just written and
  // dismissed the hint before a single frame of it was painted. The hint could
  // never be seen by anyone. Held in a ref, and the mount work is a one-shot.
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  const initedRef = useRef(false);

  const close = useCallback(() => {
    setShow(false);
    dismissRef.current();
  }, []);

  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      /* private mode, just show it */
    }
    if (seen) {
      dismissRef.current();
      return;
    }
    setShow(true);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  // Dismiss on the next scroll (the user has moved on), and on a timer. Under
  // reduced motion the timer is skipped: content that vanishes on its own is
  // the same problem as content that moves on its own, so it holds until the
  // user dismisses it.
  useEffect(() => {
    if (!show) return;
    window.addEventListener("wheel", close, { once: true, passive: true });
    window.addEventListener("touchmove", close, { once: true, passive: true });
    const t = reduce ? null : window.setTimeout(close, AUTO_HIDE_MS);
    return () => {
      window.removeEventListener("wheel", close);
      window.removeEventListener("touchmove", close);
      if (t !== null) window.clearTimeout(t);
    };
  }, [show, reduce, close]);

  if (!show || !match) return null;

  // Tethered under the bag and right-aligned to it, clamped so a narrow phone
  // never pushes the card off the left edge.
  const right = Math.max(8, window.innerWidth - (match.rect.left + match.rect.width));
  const top = match.rect.top + match.rect.height + 8;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: DURATION.standard, ease: EASE.enter }}
      className="fixed z-[110] max-w-[min(19rem,calc(100vw-1rem))]"
      style={{ top, right }}
    >
      <div className="relative rounded-card border border-white/12 bg-navy-900/95 p-3 shadow-menu backdrop-blur">
        {/* Pointer up at the bag, so the callout is clearly about that control. */}
        <span
          aria-hidden="true"
          className="absolute -top-1.5 right-5 block h-3 w-3 rotate-45 border-l border-t border-white/12 bg-navy-900/95"
        />
        <Link
          href="/pebbles"
          className="block text-[13px] leading-5 text-white/80 hover:text-white"
        >
          <span className="font-semibold text-teal-300">
            {earned > 0 ? `You earned ${earned} ${earned === 1 ? "pebble" : "pebbles"}.` : "Your pebbles."}
          </span>{" "}
          Rare finds and first sightings pay more, and a call the community later
          agrees with pays again.
        </Link>
        <button
          type="button"
          onClick={close}
          aria-label="Dismiss"
          // 44px touch target around a 26px glyph (the mobile minimum applies to
          // the hit area, not the ink).
          className="absolute -right-4 -top-4 z-10 inline-flex h-11 w-11 items-center justify-center text-white/60 hover:text-white"
        >
          <span className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-full border border-white/12 bg-navy-900">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
        </button>
      </div>
    </motion.div>
  );
}
