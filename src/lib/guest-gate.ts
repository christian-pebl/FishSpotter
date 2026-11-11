/**
 * The guest gate's "is it up?" state, shared by the gate itself
 * (src/components/guest/GuestGate.tsx) and the feed behind it
 * (src/components/FeedPlayer.tsx).
 *
 * The gate is the age question a signed-out spotter meets on the feed. While it
 * is on screen the feed is covered and nobody has chosen to watch anything, so
 * the feed holds its clips back: until 11 Nov 2026 it fetched them anyway,
 * 36 MB on a desktop and 10.9 MB on a phone before the first tap.
 *
 * One module owns the storage key and the event so the two components cannot
 * drift apart: if the feed and the gate disagreed about whether the gate was
 * dismissed, the feed would sit on a poster with no clip behind it.
 */

import type { SessionContextValue } from "next-auth/react";

/** Set for the tab once the visitor taps "Just watch for now". */
export const GUEST_GATE_DISMISS_KEY = "fishspotter:guestGateDismissed";

/** Fired on `window` when the gate is dismissed, so the feed can start. */
export const GUEST_GATE_CLOSED_EVENT = "fishspotter:guestGateClosed";

/**
 * Has this tab already dismissed the gate? False when storage is unavailable
 * (private mode), which matches the gate: with nothing remembered it shows.
 */
export function isGuestGateDismissed(): boolean {
  try {
    return sessionStorage.getItem(GUEST_GATE_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Remember the dismissal for the tab and tell the feed. */
export function dismissGuestGate(): void {
  try {
    sessionStorage.setItem(GUEST_GATE_DISMISS_KEY, "1");
  } catch {
    /* private mode: the event below still releases the feed for this page */
  }
  window.dispatchEvent(new Event(GUEST_GATE_CLOSED_EVENT));
}

/** Forget the dismissal (a guest account was just started). */
export function clearGuestGateDismissal(): void {
  try {
    sessionStorage.removeItem(GUEST_GATE_DISMISS_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Should the feed hold its clips back because the guest gate is (or is about
 * to be) on screen?
 *
 * `signedOutAtRender` is the server's view when it rendered the page. It is the
 * part that matters most: a `<video src>` in the server HTML starts downloading
 * before any script runs, so the decision to leave `src` off has to be made on
 * the server, for exactly the visitors the gate will greet.
 *
 * It releases as soon as either is true: the visitor is signed in (the gate
 * never shows, or they just started a guest game), or the gate was dismissed
 * in this tab. A session still loading counts as "not yet", so the feed never
 * starts a download it would have to regret a moment later.
 *
 * Signed-in visitors are never held: `signedOutAtRender` is false for them and
 * their clip is in the HTML exactly as before.
 */
export function shouldHoldVideoForGuestGate(input: {
  signedOutAtRender: boolean;
  sessionStatus: SessionContextValue["status"];
  dismissed: boolean;
}): boolean {
  if (!input.signedOutAtRender) return false;
  if (input.sessionStatus === "authenticated") return false;
  return !input.dismissed;
}
