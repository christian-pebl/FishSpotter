"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { DURATION } from "@/lib/motion";

/**
 * Fade-and-rise the first time an element is scrolled into view, in plain CSS.
 *
 * The landing page's "how it works" cards used `motion.article` with
 * `whileInView`, which was the only reason framer-motion (41 KB over the wire)
 * sat in the JavaScript every first visit downloads before the first paint.
 * This is the same effect with the same numbers, driven by one
 * IntersectionObserver and a CSS transition:
 *
 *   - opacity 0 to 1 and a 24 px rise to rest,
 *   - 0.3 s ease-out (`DURATION.layout`, the same token the card used),
 *   - 0.12 s stagger per `index`,
 *   - once, when 40% of the element is on screen.
 *
 * The hidden state is in the server-rendered markup (as `initial` was), so the
 * card never flashes at rest before it hides. Reduced motion is honoured by the
 * global `prefers-reduced-motion` rule in globals.css, which cuts transition
 * durations to nothing: the card still ends up in the same place, it just does
 * not travel there.
 */

/** How far below its resting place the element waits, in px. */
const RISE_PX = 24;
/** Share of the element that must be on screen before it reveals. */
const VISIBLE_AMOUNT = 0.4;
/** Extra delay per sibling, in ms. */
const STAGGER_MS = 120;

export function RevealOnView({
  index = 0,
  className,
  children,
}: {
  /** Position among its siblings; sets the stagger. */
  index?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      // No observer: show it rather than leave content hidden for ever.
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: VISIBLE_AMOUNT },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const duration = Math.round(DURATION.layout * 1000);
  const delay = index * STAGGER_MS;

  return (
    <article
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : `translateY(${RISE_PX}px)`,
        transition: `opacity ${duration}ms ease-out ${delay}ms, transform ${duration}ms ease-out ${delay}ms`,
      }}
    >
      {children}
    </article>
  );
}
