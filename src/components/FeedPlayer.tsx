"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FeedCard } from "./FeedCard";

const HINT_STORAGE_KEY = "fishspotter:navHintSeen";

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
  staffAnswer: string;
  bboxes: BBoxFrame[] | null;
}

interface FeedPlayerProps {
  snippets: FeedSnippet[];
}

export function FeedPlayer({ snippets }: FeedPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hintVisible, setHintVisible] = useState(false);
  const [hintIsTouch, setHintIsTouch] = useState(false);

  const scrollToIndex = useCallback((index: number) => {
    const el = containerRef.current;
    if (!el) return;
    const next = el.querySelector<HTMLElement>(`[data-feed-index="${index}"]`);
    if (!next) return;
    el.scrollTo({ top: next.offsetTop, behavior: "smooth" });
  }, []);

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
      <div className="flex-1 flex items-center justify-center text-slate-500">
        No clips yet. Run the seed script or{" "}
        <a href="/feed/browse" className="text-cyan-400 underline">
          browse all
        </a>
        .
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-y-auto snap-y snap-mandatory"
      >
        {snippets.map((snippet, index) => (
          <section
            key={snippet.id}
            data-feed-index={index}
            className="h-full snap-start snap-always flex flex-col bg-slate-900"
          >
            <FeedCard
              snippet={snippet}
              isActive={activeIndex === index}
              preload={Math.abs(activeIndex - index) <= 1}
              hasNext={index < snippets.length - 1}
              onAdvance={() => scrollToIndex(index + 1)}
            />
          </section>
        ))}
      </div>
      <AnimatePresence>
        {hintVisible && (
          <motion.div
            key="nav-hint"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.35 }}
            className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center"
          >
            <div className="flex items-center gap-2 rounded-full bg-black/55 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-white/85 backdrop-blur-sm">
              <motion.span
                aria-hidden
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                className="text-sm leading-none"
              >
                ↑
              </motion.span>
              <span>{hintIsTouch ? "Swipe up for next" : "Scroll for next"}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
