"use client";

import { useEffect } from "react";
import { initEngagement, setActiveClip } from "@/lib/engagement";

/**
 * Wire the engagement tracker to the feed's active clip. No-ops entirely without
 * analytics consent (the underlying module checks on every call). Banks the
 * final watch segment on unmount.
 */
export function useEngagementTracker(activeSnippetId: string | null) {
  useEffect(() => {
    initEngagement();
  }, []);

  useEffect(() => {
    setActiveClip(activeSnippetId);
  }, [activeSnippetId]);

  useEffect(() => {
    return () => setActiveClip(null);
  }, []);
}
