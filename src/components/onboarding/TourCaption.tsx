"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { DURATION, EASE } from "@/lib/motion";
import type { AnchorRect } from "./useAnchorRect";

const GAP = 14;

/**
 * The tour's instruction card.
 *
 * Placed on whichever side of the spotlit element has room, so the caption does
 * not cover the thing it is describing. Horizontally it is a full-width band
 * with the text capped at a readable measure, which is both simpler and
 * steadier than tracking the anchor's x: the caption stays put while the
 * spotlight travels, so the user's eye is not chasing two moving things.
 *
 * The card's height is MEASURED, not assumed. An earlier version guessed at it,
 * and on step 1 (where the anchor is the clip and fills nearly the whole
 * viewport) the "place above" branch put the card at `bottom: viewportH + GAP`
 * and threw it clean off the top of the screen. Hence the third branch below,
 * for when the anchor IS effectively the whole screen.
 *
 * ACCESSIBILITY: deliberately NOT a modal and deliberately not focus-trapped.
 * The tour points at live controls the user has to reach, so trapping focus in
 * this card would make the tour impossible to complete by keyboard. It is a
 * `role="region"` that announces the step politely and never steals focus; the
 * controller wires Escape to skip. (This inverts the modal contract the old
 * three-slide tour used, which was right for a dialog that covered the app and
 * wrong for coach marks over it.)
 */
export function TourCaption({
  anchor,
  eyebrow,
  title,
  body,
  stepIndex,
  stepCount,
  nextLabel,
  onNext,
  onBack,
  onSkip,
}: {
  anchor: AnchorRect | null;
  eyebrow: string;
  title: string;
  body: string;
  stepIndex: number;
  stepCount: number;
  /** Null hides the forward button entirely (the step advances on a real tap). */
  nextLabel: string | null;
  onNext: () => void;
  onBack: (() => void) | null;
  onSkip: () => void;
}) {
  const reduce = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(200);
  const [viewportH, setViewportH] = useState(0);

  // Measure the card (the copy length varies per step) and the viewport. Both
  // feed the placement maths below, so both have to be real numbers rather than
  // constants, and both have to be read after paint.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const sync = () => {
      setCardH(el.getBoundingClientRect().height);
      setViewportH(window.innerHeight);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [title, body, nextLabel]);

  useEffect(() => {
    const onResize = () => setViewportH(window.innerHeight);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const need = cardH + GAP * 2;
  const spaceBelow = anchor && viewportH ? viewportH - (anchor.top + anchor.height) : Infinity;
  const spaceAbove = anchor ? anchor.top : 0;

  let placement: { top: number } | { bottom: number };
  if (!anchor || !viewportH) {
    // Nothing measured yet (a gate mid-enter). Top, so the first paint lands
    // where the fallback below would put it and nothing jumps on resolve.
    placement = { top: GAP };
  } else if (spaceBelow >= need) {
    placement = { top: Math.min(anchor.top + anchor.height + GAP, viewportH - cardH - GAP) };
  } else if (spaceAbove >= need) {
    placement = { bottom: Math.min(viewportH - anchor.top + GAP, viewportH - cardH - GAP) };
  } else {
    // Neither side fits, so the caption has to sit ON the anchor: the clip fills
    // the frame on step 1, and the species page is a near-full-height dialog on
    // step 5.
    //
    // It goes at the TOP, and that is not arbitrary. Every surface in this app
    // puts its primary action at the BOTTOM: the species page's "This is my
    // pick", the gate's compare / skip footer, the feed's identify bar. A
    // bottom-docked caption covered "This is my pick" outright, so the tour
    // physically blocked the one action the step was telling the user to take.
    // Overlapping a surface's header (a title, a secondary Back) is the far
    // cheaper collision.
    placement = { top: GAP };
  }

  return (
    <div
      role="region"
      aria-label="Getting started"
      className="pointer-events-none fixed inset-x-0 z-[111] flex justify-center px-3"
      style={placement}
    >
      <motion.div
        ref={cardRef}
        initial={reduce ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduce ? { duration: 0 } : { duration: DURATION.standard, ease: EASE.enter }}
        // The CARD stays pointer-transparent and only its buttons take taps.
        // On a 390px phone this band is 390x232 of full-width real estate
        // floating over bottom sheets, and while it was pointer-opaque it
        // swallowed taps meant for the candidate tiles underneath it. A coach
        // mark that intercepts the taps it is coaching is worse than no coach
        // mark, so the blocking area is now three small controls, not a slab.
        className="pointer-events-none w-full max-w-sm rounded-card border border-white/12 bg-navy-900/95 p-4 shadow-menu backdrop-blur"
      >
        <p className="sr-only" aria-live="polite">
          Step {stepIndex + 1} of {stepCount}. {title}
        </p>

        <p className="pebl-eyebrow text-teal-300">{eyebrow}</p>
        <h2 className="mt-1.5 font-brand text-h3 leading-tight text-white">{title}</h2>
        <p className="mt-2 text-[13px] leading-6 text-white/75">{body}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {Array.from({ length: stepCount }, (_, i) => (
              <span
                key={i}
                className={
                  "h-1.5 rounded-full transition-all " +
                  (i === stepIndex
                    ? "w-5 bg-teal-400"
                    : i < stepIndex
                      ? "w-2 bg-teal-400/45"
                      : "w-2 bg-white/20")
                }
              />
            ))}
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex min-h-[44px] items-center rounded-full px-3 text-[11px] font-semibold uppercase tracking-wider text-white/60 hover:bg-white/10 hover:text-white"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={onSkip}
              className="inline-flex min-h-[44px] items-center rounded-full px-3 text-[11px] font-semibold uppercase tracking-wider text-white/60 hover:bg-white/10 hover:text-white"
            >
              Skip
            </button>
            {nextLabel && (
              <button
                type="button"
                onClick={onNext}
                className="inline-flex min-h-[44px] items-center rounded-full bg-teal-500 px-4 text-[11px] font-semibold uppercase tracking-wider text-navy-900 hover:bg-teal-400"
              >
                {nextLabel}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
