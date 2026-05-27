/**
 * Thin iNaturalist API client for fetching CC-licensed photos per species.
 *
 * Docs: https://api.inaturalist.org/v1/docs
 *
 * Rate limit: ~60 req/min recommended, 10k/day. We're well below both for
 * a backfill of ~26 species, but throttle anyway to be polite.
 */

const INAT_BASE = "https://api.inaturalist.org/v1";

// Comma-joined license filter passed to /observations. Project policy is
// "maximise photos for open-access non-commercial use" so we accept all four
// CC licenses; CC-BY-NC dominates iNat for fish, excluding it would halve
// our pool.
export const INAT_LICENSE_FILTER = "cc0,cc-by,cc-by-sa,cc-by-nc";

// Annotation term IDs from https://www.inaturalist.org/pages/annotations
const TERM_LIFE_STAGE = 1;
const TERM_SEX = 9;

// Term value IDs for Life Stage (filtered to fish-relevant only).
const LIFE_STAGE_VALUES: Record<string, number> = {
  adult: 2,
  teneral: 3,
  pupa: 4,
  nymph: 5,
  larva: 6,
  egg: 7,
  juvenile: 8,
  subimago: 16,
};

const SEX_VALUES: Record<string, number> = {
  female: 10,
  male: 11,
};

export type InatPhoto = {
  url: string;        // small (max 240px) — we'll rewrite to medium below
  mediumUrl: string;  // medium (max 500px)
  largeUrl: string;   // large (max 1024px)
  attribution: string;
  license: string;
  sourceUrl: string;  // link to the observation
  width: number | null;
  height: number | null;
  lifeStage: string | null;
  sex: string | null;
};

// iNat photo URLs are versioned by size — the API returns the `square`
// thumbnail but the same path with `medium` / `large` works.
function rewriteSize(url: string, size: "medium" | "large" | "square"): string {
  return url.replace(/\/(square|small|medium|large|original)\.(jpe?g|png|webp)/i, `/${size}.$2`);
}

type InatObservation = {
  id: number;
  uri: string;
  photos?: Array<{
    url: string;
    license_code: string | null;
    attribution: string;
    original_dimensions?: { width: number; height: number } | null;
  }>;
  annotations?: Array<{
    controlled_attribute_id: number;
    controlled_value_id: number;
  }>;
};

function annotationLabel(termId: number, valueId: number): string | null {
  const table = termId === TERM_LIFE_STAGE ? LIFE_STAGE_VALUES : termId === TERM_SEX ? SEX_VALUES : null;
  if (!table) return null;
  for (const [label, id] of Object.entries(table)) if (id === valueId) return label;
  return null;
}

// Retry behaviour for transient iNat failures (Q3A-T6, 27 May 2026).
// iNat enforces ~60 req/min and 10k/day. A full db:refresh-images run
// across 26 species with multiple buckets each can bump up against the
// per-minute ceiling under bursty conditions. Retry on 429 / 503 with
// exponential backoff so a single rate-limit hit doesn't fail the
// whole refresh; for other 4xx (404, 400) fail fast since retrying
// won't help.
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 8000;

export function nextRetryDelay(
  attempt: number,
  retryAfterHeader: string | null,
  rng: () => number = Math.random,
): number {
  // Honour the server's Retry-After header (seconds or HTTP-date) when
  // present. iNat sends seconds, but parse defensively.
  if (retryAfterHeader) {
    const asSeconds = Number(retryAfterHeader);
    if (Number.isFinite(asSeconds) && asSeconds > 0) {
      return Math.min(asSeconds * 1000, MAX_DELAY_MS);
    }
    const asDate = Date.parse(retryAfterHeader);
    if (Number.isFinite(asDate)) {
      const delta = asDate - Date.now();
      if (delta > 0) return Math.min(delta, MAX_DELAY_MS);
    }
  }
  // Exponential backoff with 0-25% jitter.
  const exp = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  const jitter = exp * 0.25 * rng();
  return exp + jitter;
}

export function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 503 || status === 502 || status === 504;
}

async function fetchWithRetry(url: string): Promise<Response> {
  let attempt = 0;
  while (true) {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        // iNaturalist recommends a User-Agent that identifies the caller so
        // they can contact us if we misbehave.
        "User-Agent": "FishSpotter/1.0 (https://fish-spotter.vercel.app)",
      },
    });
    if (res.ok) return res;
    // Non-retryable 4xx: fail immediately so a 404 doesn't waste 3 attempts.
    if (!isRetryableStatus(res.status)) return res;
    // Out of retries: surface the last response to the caller.
    if (attempt >= MAX_RETRIES - 1) return res;
    const delay = nextRetryDelay(attempt, res.headers.get("Retry-After"));
    await new Promise((resolve) => setTimeout(resolve, delay));
    attempt++;
  }
}

async function fetchObservationPage(params: URLSearchParams): Promise<InatObservation[]> {
  const url = new URL(`${INAT_BASE}/observations`);
  for (const [k, v] of params) url.searchParams.set(k, v);
  const res = await fetchWithRetry(url.toString());
  if (!res.ok) {
    throw new Error(`iNaturalist ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { results?: InatObservation[] };
  return json.results ?? [];
}

function obsToPhotos(obs: InatObservation): InatPhoto[] {
  if (!obs.photos || obs.photos.length === 0) return [];
  // Pull life-stage / sex from observation annotations and apply to all
  // photos in this observation. iNat doesn't annotate per-photo.
  let lifeStage: string | null = null;
  let sex: string | null = null;
  for (const a of obs.annotations ?? []) {
    const lbl = annotationLabel(a.controlled_attribute_id, a.controlled_value_id);
    if (!lbl) continue;
    if (a.controlled_attribute_id === TERM_LIFE_STAGE && !lifeStage) lifeStage = lbl;
    if (a.controlled_attribute_id === TERM_SEX && !sex) sex = lbl;
  }
  return obs.photos
    .filter((p) => !!p.url && !!p.license_code)
    .map((p) => ({
      url: p.url,
      mediumUrl: rewriteSize(p.url, "medium"),
      largeUrl: rewriteSize(p.url, "large"),
      attribution: p.attribution,
      license: p.license_code ?? "",
      sourceUrl: obs.uri,
      width: p.original_dimensions?.width ?? null,
      height: p.original_dimensions?.height ?? null,
      lifeStage,
      sex,
    }));
}

export async function fetchPhotosForSpecies(args: {
  scientificName: string;
  perPage?: number;
  lifeStage?: keyof typeof LIFE_STAGE_VALUES;
  sex?: keyof typeof SEX_VALUES;
}): Promise<InatPhoto[]> {
  // iNat's term_id parameter is single-valued — we can't ask for "adult AND
  // male" in one call. When the caller wants both, query with sex (rarer,
  // more discriminating) and post-filter on the lifeStage annotation
  // returned in each observation. Bump perPage to soak up the rejection
  // rate from the client-side filter.
  const wantBoth = !!args.lifeStage && !!args.sex;
  const perPage = args.perPage ?? 12;
  const apiPerPage = wantBoth ? Math.min(perPage * 3, 30) : perPage;

  const params = new URLSearchParams({
    taxon_name: args.scientificName,
    photo_license: INAT_LICENSE_FILTER,
    quality_grade: "research",
    per_page: String(apiPerPage),
    order_by: "votes",
    order: "desc",
  });
  if (args.sex) {
    params.set("term_id", String(TERM_SEX));
    params.set("term_value_id", String(SEX_VALUES[args.sex]));
  } else if (args.lifeStage) {
    params.set("term_id", String(TERM_LIFE_STAGE));
    params.set("term_value_id", String(LIFE_STAGE_VALUES[args.lifeStage]));
  }

  const obs = await fetchObservationPage(params);
  let photos: InatPhoto[] = [];
  for (const o of obs) photos.push(...obsToPhotos(o));

  if (wantBoth) {
    const wantedStage = args.lifeStage!;
    photos = photos.filter((p) => p.lifeStage === wantedStage);
    photos = photos.slice(0, perPage);
  }
  return photos;
}
