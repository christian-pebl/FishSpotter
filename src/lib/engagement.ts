"use client";

/**
 * Client-side engagement tracker (Climate Action Fund impact measurement).
 *
 * Privacy-first and deliberately minimal:
 *   - Does NOTHING unless the visitor opted into analytics (hasAnalyticsConsent).
 *   - The session id is random and lives in sessionStorage, so it dies with the
 *     tab — nothing follows a person across visits.
 *   - Watch-time is the ACTIVE clip's on-screen, tab-visible time, flushed in
 *     short segments via navigator.sendBeacon so a crash/close loses ~nothing.
 *
 * Three event types only (see src/lib/events.ts): session_start, clip_view,
 * clip_watch. Everything else the funder needs (IDs, accuracy, species learned)
 * is derived from existing tables — not tracked here.
 */

import { hasAnalyticsConsent } from "@/lib/cookies/client-consent";
import type { EventType } from "@/lib/events";

const SESSION_KEY = "fishspotter:sid";
const FLUSH_INTERVAL_MS = 25_000; // segment long watches so they flush mid-clip
const MIN_SEGMENT_SECONDS = 1; // ignore sub-second flickers

type QueuedEvent = {
  type: EventType;
  sessionId: string;
  snippetId?: string;
  value?: number;
};

let queue: QueuedEvent[] = [];
let activeSnippet: string | null = null;
let segmentStart: number | null = null; // ms timestamp of the current watch segment
let listenersBound = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID().replace(/-/g, "");
    }
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** Get (or lazily create) the per-tab session id, firing session_start once. */
function getSessionId(): string | null {
  if (!hasAnalyticsConsent()) return null;
  try {
    let id = window.sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = randomId();
      window.sessionStorage.setItem(SESSION_KEY, id);
      queue.push({ type: "session_start", sessionId: id });
    }
    return id;
  } catch {
    return null;
  }
}

function enqueue(type: EventType, snippetId?: string, value?: number) {
  const sessionId = getSessionId();
  if (!sessionId) return;
  queue.push({ type, sessionId, snippetId, value });
}

function flush(useBeacon = false) {
  if (queue.length === 0) return;
  if (!hasAnalyticsConsent()) {
    queue = [];
    return;
  }
  const body = JSON.stringify({ events: queue });
  queue = [];
  try {
    if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* non-essential — drop silently */
  }
}

/** End the current watch segment, banking its seconds as a clip_watch event. */
function endSegment() {
  if (segmentStart != null && activeSnippet) {
    const seconds = (Date.now() - segmentStart) / 1000;
    if (seconds >= MIN_SEGMENT_SECONDS) {
      enqueue("clip_watch", activeSnippet, Math.round(seconds));
    }
  }
  segmentStart = null;
}

/** Start a watch segment if we have an active clip and the tab is visible. */
function beginSegment() {
  if (!activeSnippet) return;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
  segmentStart = Date.now();
}

function onVisibility() {
  if (document.visibilityState === "hidden") {
    endSegment();
    flush(true);
  } else {
    beginSegment();
  }
}

function onPageHide() {
  endSegment();
  flush(true);
}

function bindListeners() {
  if (listenersBound || typeof window === "undefined") return;
  listenersBound = true;
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onPageHide);
  // Periodic flush so a long single-clip watch is banked incrementally.
  intervalId = setInterval(() => {
    endSegment();
    beginSegment();
    flush(false);
  }, FLUSH_INTERVAL_MS);
  intervalId.unref?.();
}

/** Idempotent init — safe to call on every mount. */
export function initEngagement() {
  if (!hasAnalyticsConsent()) return;
  bindListeners();
}

/**
 * Set which clip is currently the active card (or null when none / unmounting).
 * Banks the previous clip's watch-time, records a clip_view for the new clip,
 * and starts a fresh watch segment.
 */
export function setActiveClip(snippetId: string | null) {
  if (!hasAnalyticsConsent()) return;
  if (snippetId === activeSnippet) return;
  endSegment();
  flush(false);
  activeSnippet = snippetId;
  if (snippetId) {
    enqueue("clip_view", snippetId);
    beginSegment();
  }
}
