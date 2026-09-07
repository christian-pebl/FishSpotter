/**
 * A best-effort, SERVER-SIDE guess at whether a request is from a
 * "desktop-class" device, from its User-Agent header alone.
 *
 * Why this exists (7 Sep 2026). `chooseVideoSrc` picks which video FILE a
 * feed card fetches, using the same viewport query the split screen already
 * relies on (`useDocked`, min-width 768px). That query is right for LAYOUT,
 * where the server's forced default of "not desktop" costs nothing (CSS has
 * no cost to being briefly wrong, corrected before the next paint). It is
 * wrong for a FETCHED RESOURCE: a `<video src>` attribute in the
 * server-rendered HTML is fetched by the browser the instant it is parsed,
 * before React ever runs, let alone corrects it. Caught on a benchmark run
 * 7 Sep 2026: a real desktop browser's active card downloaded the FULL SD
 * rendition (the server's forced "assume mobile" default), then the FULL
 * 1080p master too, once hydration corrected the viewport query, twice the
 * bytes the feature exists to save.
 *
 * A resource decision needs a resource-appropriate default. The server
 * makes its own best guess from the one signal it has and seeds the
 * client-side query with it (see `FeedCard`'s separate `useMediaQuery` call
 * for the rendition decision, seeded from this guess, kept apart from
 * `useDocked()`'s own always-false default used for layout). Getting the
 * guess wrong (a spoofed UA, an unusual browser) degrades to a one-time
 * extra fetch on that single request, not a systemic regression, since the
 * client-side query still corrects it for every card mounted afterward.
 */

// iPad is deliberately absent: modern iPadOS Safari's default UA presents as
// desktop Mac Safari (no "iPad" token) unless a site opts into the legacy UA
// string, so this pattern would rarely match one anyway, and a real iPad's
// screen is wide enough that the desktop guess is the reasonable one.
const MOBILE_UA_PATTERN = /Mobi|Android|iPhone|iPod|IEMobile|BlackBerry|Opera Mini/i;

/**
 * True when the User-Agent looks like a phone. A missing header (a bot, a
 * server-side fetch, an unusual client) returns false: uncertain defaults to
 * the desktop guess, never to guessing a phone and downgrading quality
 * without evidence.
 */
export function isLikelyMobileUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return MOBILE_UA_PATTERN.test(userAgent);
}
