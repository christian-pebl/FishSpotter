/**
 * Where a visit came from, read once on the first page of the visit and held
 * in memory for the engagement tracker's session_start.
 *
 * Why: session_start fires when the first clip becomes active on the feed,
 * which is usually one client-side hop after landing ("Start spotting" is a
 * <Link> to /feed, and it drops the query string). Reading window.location at
 * that point lost every UTM tag a flyer, partner post or QR code carried: as
 * of 7 Oct 2026 not one tagged visit had ever been recorded, including the
 * Festival of Seaweed flyer (utm_source=flyer). The root layout now calls
 * `captureLandingAttribution` on the first page, and the tracker reads it back.
 *
 * Privacy: nothing is written to a cookie or to storage, so this needs no
 * consent of its own. The values sit in a module variable, die with the page,
 * and are only ever sent inside session_start, which is itself sent only with
 * analytics consent (src/lib/engagement.ts).
 */

export interface Attribution {
  /** Referrer hostname only, never the full URL (it can carry the source page's own query). */
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

const MAX_ATTR_LEN = 128;

function clean(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, MAX_ATTR_LEN) : undefined;
}

/** Pure: the attribution carried by a query string and a referrer URL. */
export function parseAttribution(search: string, referrer: string): Attribution {
  const out: Attribution = {};
  try {
    const params = new URLSearchParams(search);
    out.utmSource = clean(params.get("utm_source"));
    out.utmMedium = clean(params.get("utm_medium"));
    out.utmCampaign = clean(params.get("utm_campaign"));
  } catch {
    /* a malformed query carries no attribution */
  }
  try {
    if (referrer) out.referrer = clean(new URL(referrer).hostname.replace(/^www\./, ""));
  } catch {
    /* an unparseable referrer is no referrer */
  }
  for (const key of Object.keys(out) as Array<keyof Attribution>) {
    if (out[key] === undefined) delete out[key];
  }
  return out;
}

let landing: Attribution | null = null;

/**
 * Record the current page as the landing page, once per page load. Later calls
 * are no-ops, so the first page of the visit wins even after client-side
 * navigation has changed the URL.
 */
export function captureLandingAttribution(): void {
  if (landing || typeof window === "undefined") return;
  landing = parseAttribution(window.location.search, document.referrer);
}

/** The landing page's attribution, capturing the current page if none was recorded yet. */
export function landingAttribution(): Attribution {
  captureLandingAttribution();
  return landing ?? {};
}

/** Test seam: forget the recorded landing page. */
export function resetLandingAttributionForTests(): void {
  landing = null;
}
