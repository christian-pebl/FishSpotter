"use client";

import { useCallback, useMemo, useRef, useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { FeedCard } from "./FeedCard";
import { TRANSITION } from "@/lib/motion";
import { useEngagementTracker } from "@/lib/useEngagement";

const HINT_STORAGE_KEY = "fishspotter:navHintSeen";
// Q3A-T7: delay the move-to-back reorder until AFTER FeedCard's
// scroll-to-next animation has settled. Since A-10 removed the 450ms
// auto-advance, onAdvance now fires on explicit Next-tap. The card
// scroll takes ~300ms (P-8 tightened layout transition), so 500ms
// total gives enough clearance without feeling sluggish.
const MOVE_TO_BACK_DELAY_MS = 500;

export interface BBoxFrame {
  frame_clip: number;
  x_norm: number;
  y_norm: number;
  w_norm: number;
  h_norm: number;
}

export interface FeedSnippet {
  id: string;
  videoUrl: string;
  thumbnailUrl: string;
  site: string;
  deployment: string;
  /** Reference identification. Null when the snippet has no reference yet (S7-T1). */
  staffAnswer: string | null;
  bboxes: BBoxFrame[] | null;
  lat: number | null;
  lon: number | null;
  depthM: number | null;
  recordingDatetime: string | null;
}

interface FeedPlayerProps {
  snippets: FeedSnippet[];
}

export function FeedPlayer({ snippets }: FeedPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hintVisible, setHintVisible] = useState(false);
  const [hintIsTouch, setHintIsTouch] = useState(false);
  const reduceMotion = useReducedMotion();
  // Q3A-T7: session-local set of snippet IDs the user answered in this
  // page lifetime. Used to push them to the back of the feed without
  // waiting for reload + server-side stable shuffle to do it. Resets on
  // page navigation, which is fine because the server-side shuffle
  // already returns answered snippets at the tail.
  const [recentlyAnswered, setRecentlyAnswered] = useState<Set<string>>(
    () => new Set(),
  );

  const orderedSnippets = useMemo(() => {
    if (recentlyAnswered.size === 0) return snippets;
    const unanswered = snippets.filter((s) => !recentlyAnswered.has(s.id));
    const answered = snippets.filter((s) => recentlyAnswered.has(s.id));
    return [...unanswered, ...answered];
  }, [snippets, recentlyAnswered]);

  // Engagement measurement (consent-gated): track the active clip + watch-time.
  useEngagementTracker(orderedSnippets[activeIndex]?.id ?? null);

  const markAnswered = useCallback((snippetId: string) => {
    window.setTimeout(() => {
      setRecentlyAnswered((prev) => {
        if (prev.has(snippetId)) return prev;
        const next = new Set(prev);
        next.add(snippetId);
        return next;
      });
    }, MOVE_TO_BACK_DELAY_MS);
  }, []);

  const scrollToIndex = useCallback(
    (index: number) => {
      const el = containerRef.current;
      if (!el) return;
      // Q3A-T7: cap against the rendered (reordered) list length.
      const total = el.querySelectorAll("[data-feed-index]").length;
      const clamped = Math.max(0, Math.min(total - 1, index));
      const next = el.querySelectorAll<HTMLElement>("[data-feed-index]")[clamped];
      if (!next) return;
      el.scrollTo({ top: next.offsetTop, behavior: reduceMotion ? "auto" : "smooth" });
    },
    [reduceMotion],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === "j") {
        e.preventDefault();
        scrollToIndex(activeIndex + 1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp" || e.key === "k") {
        e.preventDefault();
        scrollToIndex(activeIndex - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, scrollToIndex]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const sections = el.querySelectorAll("[data-feed-index]");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset.feedIndex);
          if (!Number.isNaN(index)) setActiveIndex(index);
        }
      },
      { root: el, rootMargin: "0px", threshold: 0.5 }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [snippets.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (snippets.length <= 1) return;
    try {
      if (localStorage.getItem(HINT_STORAGE_KEY) === "1") return;
    } catch {}
    setHintIsTouch(window.matchMedia("(pointer: coarse)").matches);
    setHintVisible(true);
    const t = window.setTimeout(() => setHintVisible(false), 6000);
    return () => window.clearTimeout(t);
  }, [snippets.length]);

  useEffect(() => {
    if (!hintVisible) return;
    if (activeIndex > 0) setHintVisible(false);
  }, [activeIndex, hintVisible]);

  useEffect(() => {
    if (hintVisible) return;
    try {
      localStorage.setItem(HINT_STORAGE_KEY, "1");
    } catch {}
  }, [hintVisible]);

  if (snippets.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="pebl-surface max-w-sm rounded-card p-6 text-center">
          <p className="pebl-eyebrow">Empty feed</p>
          <h2 className="mt-2 font-brand-heading text-h3 text-navy-900">
            No clips here yet
          </h2>
          <p className="mt-2 text-sm text-navy-900/72">
            New underwater snippets are added as deployments come in. Browse the
            archive in the meantime.
          </p>
          <a
            href="/feed/browse"
            className="pebl-button-primary mt-4 inline-flex min-h-[44px] items-center px-5 text-sm"
          >
            Browse the archive
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-y-auto snap-y snap-mandatory"
      >
        {orderedSnippets.map((snippet, index) => (
          // Q3A-T7: motion.section with `layout` so the reorder animates
          // when a card is moved to the back after submission. Stable
          // key on snippet.id (NOT index) so React preserves the same
          // DOM node and Framer can interpolate position smoothly.
          // Q4-A-1: off-screen cards must be `inert` so keyboard users
          // tabbing through the feed don't walk into hidden cards' buttons.
          // tabIndex=-1 on the <video> alone leaves every Button + Link
          // inside an inactive card focusable. `inert` removes the whole
          // subtree from the accessibility tree and disables pointer events.
          // Spread-pattern because React 18.3 hasn't typed `inert` on JSX
          // intrinsics yet (React 19 supports it as a boolean prop).
          <motion.section
            key={snippet.id}
            layout={reduceMotion ? false : "position"}
            transition={reduceMotion ? { duration: 0 } : TRANSITION.layout}
            data-feed-index={index}
            {...(activeIndex === index ? {} : ({ inert: "" } as unknown as { inert?: boolean }))}
            className="h-full snap-start snap-always flex flex-col bg-slate-900"
          >
            <FeedCard
              snippet={snippet}
              isActive={activeIndex === index}
              preload={Math.abs(activeIndex - index) <= 1}
              hasNext={index < orderedSnippets.length - 1}
              onAdvance={() => scrollToIndex(index + 1)}
              onAnswered={() => markAnswered(snippet.id)}
            />
          </motion.section>
        ))}
      </div>
      <AnimatePresence>
        {hintVisible && (
          // Float ABOVE FeedCard's docked "Watching… tap to identify" bar.
          // That bar is absolute bottom-0 h-14 (3.5rem) and is present on the
          // first card during the exact window this onboarding hint shows (the
          // watch-first auto-collapse), so a bottom-0.75rem hint landed right
          // on top of it. Clear the bar (3.5rem) + a gap so the two bottom
          // overlays stack instead of colliding.
          <motion.div
            key="nav-hint"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: 0.35 }}
            className="pointer-events-none absolute inset-x-0 z-30 flex justify-center"
            style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 4.25rem)" }}
          >
            <div className="flex items-center gap-2 rounded-full bg-black/55 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-eyebrow text-white/85 backdrop-blur-sm">
              <motion.span
                aria-hidden
                animate={reduceMotion ? undefined : { y: [0, -3, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                className="leading-none"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="2,9 7,4 12,9" /></svg>
              </motion.span>
              <span>
                {hintIsTouch ? "Swipe up for next" : "Use ↑/↓ or scroll for next"}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
