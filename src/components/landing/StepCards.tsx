"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { DURATION, EASE } from "@/lib/motion";

/**
 * The "how it works" loop, shown as three visual cards (Spot -> Compare
 * -> Streak) that stagger in on scroll. Each carries a stroked teal icon
 * (never emoji) and a faint corner silhouette watermark. A dotted teal
 * path behind the row on desktop signals that it's a repeating loop.
 */

type Step = {
  eyebrow: string;
  title: string;
  body: string;
  icon: ReactNode;
  silhouette: string;
};

const stroke = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const STEPS: Step[] = [
  {
    eyebrow: "1 · Spot",
    title: "Spot the species",
    body: "Each clip is a short underwater snippet. Pick the species from a small set of likely candidates: local marine life curated by PEBL ecologists.",
    silhouette: "fish",
    icon: (
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <circle cx="13" cy="13" r="7.5" {...stroke} />
        <path d="M13 2.5v3M13 20.5v3M2.5 13h3M20.5 13h3" {...stroke} />
        <circle cx="13" cy="13" r="1.6" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    eyebrow: "2 · Compare",
    title: "Compare with the reference ID",
    body: "See the reference identification where one exists, how the wider community guessed, and an ecological-likelihood breakdown for the site and season. Clips without a reference are worth more.",
    silhouette: "jellyfish",
    icon: (
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <path d="M5 21V11M11 21V6M17 21v-7M23 21V9" {...stroke} />
        <path d="M3 21h21" {...stroke} />
      </svg>
    ),
  },
  {
    eyebrow: "3 · Streak",
    title: "Build a streak",
    body: "Identify clips on consecutive days to grow a streak. Get on the leaderboard once you've submitted 10 identifications.",
    silhouette: "starfish",
    icon: (
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <path
          d="M13 2.5c1.8 4.2 1.2 6.6-1 8.8 3.4-.4 4.8-2.2 5.4-4.8 2.6 3 3.6 6.2 3.6 9.1A8 8 0 0 1 5 15c0-2.2.8-4 2.2-5.2.3 1.6 1 2.6 2.3 3.2-1.6-3.4-.8-7 3.5-10.5Z"
          {...stroke}
        />
      </svg>
    ),
  },
];

export function StepCards() {
  return (
    <div className="relative">
      {/* Dotted loop path behind the cards (desktop only). */}
      <div
        aria-hidden="true"
        className="absolute left-[16%] right-[16%] top-12 hidden border-t-2 border-dashed border-teal-500/35 md:block"
      />
      <div className="relative grid gap-4 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <motion.article
            key={step.eyebrow}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: DURATION.layout, ease: EASE.enter, delay: i * 0.12 }}
            className="pebl-surface group relative overflow-hidden rounded-card p-5"
          >
            {/* Corner silhouette watermark. */}
            <div
              aria-hidden="true"
              className="absolute -right-3 -top-3 h-24 w-24 text-teal-700/[0.06] transition-transform duration-500 group-hover:scale-110"
              style={{
                WebkitMaskImage: `url(/silhouettes/${step.silhouette}.svg)`,
                maskImage: `url(/silhouettes/${step.silhouette}.svg)`,
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskSize: "contain",
                maskSize: "contain",
                backgroundColor: "currentColor",
              }}
            />

            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700 ring-1 ring-teal-500/30">
                {step.icon}
              </div>
              <p className="pebl-eyebrow mt-4 text-xs">{step.eyebrow}</p>
              <h3 className="mt-2 text-xl font-bold text-navy-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-navy-900">{step.body}</p>
            </div>
          </motion.article>
        ))}
      </div>
    </div>
  );
}
