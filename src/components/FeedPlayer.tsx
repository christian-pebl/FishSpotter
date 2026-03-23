"use client";

import { useRef, useEffect, useState } from "react";
import { FeedCard } from "./FeedCard";

export interface FeedSnippet {
  id: string;
  videoUrl: string;
  thumbnailUrl: string;
  site: string;
  deployment: string;
  staffAnswer: string;
}

interface FeedPlayerProps {
  snippets: FeedSnippet[];
}

export function FeedPlayer({ snippets }: FeedPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

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
    <div
      ref={containerRef}
      className="flex-1 min-h-0 overflow-y-auto snap-y snap-mandatory"
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
          />
        </section>
      ))}
    </div>
  );
}
