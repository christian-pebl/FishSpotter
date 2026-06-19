/**
 * Shared engagement-event contract (no server/client imports, so both the
 * /api/events route and the client tracker can depend on it).
 *
 * Kept deliberately small — three event types are enough to measure the
 * Climate Action Fund outcomes that aren't already derivable from the Answer /
 * UnlockedSpecies tables:
 *   - session_start : one per tab session (reach / active users)
 *   - clip_view     : a clip became the active card (breadth of viewing)
 *   - clip_watch    : flushed ACTIVE watch-time in seconds (engagement depth)
 */
export const EVENT_TYPES = ["session_start", "clip_view", "clip_watch"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** Cap a single beacon so a malformed/abusive client can't bulk-insert. */
export const MAX_EVENTS_PER_BATCH = 50;

/** Sanity clamp on clip_watch seconds (a day) — guards against bad clocks. */
export const MAX_WATCH_SECONDS = 24 * 60 * 60;
