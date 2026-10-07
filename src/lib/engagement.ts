"use client";

/**
 * Client-side engagement tracker (Climate Action Fund impact measurement).
 *
 * Privacy-first and deliberately minimal:
 *   - Does NOTHING unless the visitor opted into analytics (hasAnalyticsConsent).
 *   - The session id is random and lives in sessionStorage, so it dies with the
 *     tab, nothing follows a person across visits.
 *   - Watch-time is the ACTIVE clip's on-screen, tab-visible time while someone
 *     is there: it stops two minutes after the last tap, swipe, key or scroll
 *     (clips loop, so an abandoned tab used to count forever). Flushed in short
 *     segments via navigator.sendBeacon so a crash/close loses ~nothing. The
 *     rules live in src/lib/watch-time.ts.
 *
 * Three event types only (see src/lib/events.ts): session_start, clip_view,
 * clip_watch. Everything else the funder needs (IDs, accuracy, species learned)
 * is derived from existing tables, not tracked here. session_start also
 * carries a one-time referrer hostname + UTM params (landing-page attribution
 * only, never a fingerprint) so a traffic source can be tied to the funnel.
 * They are read from the first page of the visit (src/lib/landing-attribution.ts),
 * not from the feed's URL, which has usually lost its query string by then.
 */

import { hasAnalyticsConsent } from "@/lib/cookies/client-consent";
import type { EventType } from "@/lib/events";
import { landingAttribution } from "@/lib/landing-attribution";
import { countableWatchSeconds, isWatchIdle } from "@/lib/watch-time";

const SESSION_KEY = "fishspotter:sid";
const FLUSH_INTERVAL_MS = 25_000; // segment long watches so they flush mid-clip
const MIN_SEGMENT_SECONDS = 1; // ignore sub-second flickers
const INPUT_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

type QueuedEvent = {
  type: EventType;
  sessionId: string;
  snippetId?: string;
  value?: number;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};

let queue: QueuedEvent[] = [];
let activeSnippet: string | null = null;
let segmentStart: number | null = null; // ms timestamp of the current watch segment
let lastInputAt = 0; // ms timestamp of the last tap, swipe, key or scroll
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
      queue.push({ type: "session_start", sessionId: id, ...landingAttribution() });
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
    /* non-essential, drop silently */
  }
}

/**
 * End the current watch segment, banking its seconds as a clip_watch event.
 * Only the time up to the idle cut-off counts, capped at one segment's worth.
 */
function endSegment() {
  if (segmentStart != null && activeSnippet) {
    const seconds = countableWatchSeconds(segmentStart, Date.now(), lastInputAt);
    if (seconds >= MIN_SEGMENT_SECONDS) {
      enqueue("clip_watch", activeSnippet, Math.round(seconds));
    }
  }
  segmentStart = null;
}

/**
 * Start a watch segment if we have an active clip, the tab is visible and the
 * viewer has done something recently. The next input restarts it (onInput).
 */
function beginSegment() {
  if (!activeSnippet) return;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
  if (isWatchIdle(Date.now(), lastInputAt)) return;
  segmentStart = Date.now();
}

function noteInput() {
  lastInputAt = Date.now();
}

function onInput() {
  noteInput();
  if (segmentStart == null) beginSegment();
}

function onVisibility() {
  if (document.visibilityState === "hidden") {
    endSegment();
    flush(true);
  } else {
    // Coming back to the tab is someone being there.
    noteInput();
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
  for (const type of INPUT_EVENTS) {
    window.addEventListener(type, onInput, { passive: true, capture: true });
  }
  // Periodic flush so a long single-clip watch is banked incrementally.
  intervalId = setInterval(() => {
    endSegment();
    beginSegment();
    flush(false);
  }, FLUSH_INTERVAL_MS);
  intervalId.unref?.();
}

/** Idempotent init, safe to call on every mount. */
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
  // Consent can arrive after the feed mounted (the banner sets the cookie
  // without a reload), so the listeners are bound here too, not only in init.
  bindListeners();
  if (snippetId === activeSnippet) return;
  endSegment();
  flush(false);
  activeSnippet = snippetId;
  if (snippetId) {
    // Reaching a new clip is itself an action: a swipe, a tap on Next, or
    // opening the feed.
    noteInput();
    enqueue("clip_view", snippetId);
    beginSegment();
  }
}
