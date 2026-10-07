"use client";

import { useEffect, useRef } from "react";
import { CONSENT_CHANGED_EVENT } from "@/lib/cookies/client-consent";
import { initEngagement, setActiveClip } from "@/lib/engagement";

/**
 * Wire the engagement tracker to the feed's active clip. No-ops entirely without
 * analytics consent (the underlying module checks on every call). Banks the
 * final watch segment on unmount.
 *
 * A visitor who accepts the cookie banner while already on the feed is picked
 * up at once: the clip on screen gets its view and the session its start (with
 * the landing page's attribution), instead of nothing being logged until the
 * next swipe, or ever, if they leave first.
 */
export function useEngagementTracker(activeSnippetId: string | null) {
  const activeRef = useRef(activeSnippetId);

  useEffect(() => {
    initEngagement();
    const onConsent = () => {
      initEngagement();
      setActiveClip(activeRef.current);
    };
    window.addEventListener(CONSENT_CHANGED_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onConsent);
  }, []);

  useEffect(() => {
    activeRef.current = activeSnippetId;
    setActiveClip(activeSnippetId);
  }, [activeSnippetId]);

  useEffect(() => {
    return () => setActiveClip(null);
  }, []);
}
