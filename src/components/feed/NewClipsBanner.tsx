"use client";

/**
 * "N new clips since your last visit" banner (2026-08-13).
 *
 * The in-app half of the new-clip notification. The email reaches a spotter who
 * has drifted away; this reaches one who came back on their own and would
 * otherwise have no idea the feed had grown. New clips already sort into the
 * unanswered tier, which orderFeed puts first, so the banner only has to say
 * that there IS something new, because the feed already leads with it.
 *
 * Dismissal is explicit and stamps User.lastFeedSeenAt, so the notice survives
 * an accidental reload rather than being burned on page load.
 */

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { TRANSITION } from "@/lib/motion";

export interface NewClipsBannerProps {
  /** Feed-visible clips added since this spotter's lastFeedSeenAt watermark. */
  count: number;
}

export function NewClipsBanner({ count }: NewClipsBannerProps) {
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(count > 0);

  if (count <= 0) return null;

  const dismiss = () => {
    setVisible(false);
    // Fire-and-forget: the banner is a nicety, and a failed stamp just means it
    // shows again next visit. Never block the spotter on it.
    void fetch("/api/account/feed-seen", { method: "POST" }).catch(() => {});
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="new-clips-banner"
          initial={reduceMotion ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={reduceMotion ? { duration: 0 } : TRANSITION.standard}
          className="absolute inset-x-0 z-30 flex justify-center px-3"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
        >
          <div className="flex items-center gap-2 rounded-full bg-teal-600 py-1.5 pl-3.5 pr-1.5 text-white shadow-menu">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 3v5m0 0l3-3m-3 3L9 5" />
              <rect x="3" y="9" width="18" height="12" rx="3" />
            </svg>
            <span className="text-xs font-semibold">
              {count} new clip{count === 1 ? "" : "s"} since your last visit
            </span>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss new clips notice"
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
