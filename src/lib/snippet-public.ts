/**
 * What the snippet API may tell someone who is not PEBL staff.
 *
 * A clip's `externalId` is its export folder name, and for 56 of 139 live
 * clips that name carries a species label (`..._wrasse00007270_...`). Its
 * storage URLs are built from the same folder name, and `staffAnswer` is the
 * label from the exporter's metadata. Until 12 Nov 2026 `GET /api/snippets`
 * handed the first two to anyone for every clip, and `GET /api/snippets/[id]`
 * returned the whole row, `staffAnswer` included. Nobody has to guess a clip
 * whose address says what is in it, and the prize for 2,000 Pebbles is real.
 *
 * So the public shape is a fixed list of fields that describe where and when a
 * clip was filmed, and nothing that names it. The `select` objects are the
 * whole of what is read from the database for a public caller: a column added
 * to the model later cannot leak through a spread, because nothing is spread.
 * Staff (verified @pebl-cic.co.uk, `getAdminSession`) get the full row, which
 * is what these two routes exist for now. Nothing in the app calls either.
 */
import type { Prisma } from "@prisma/client";

/** One row of the public list. */
export const PUBLIC_SNIPPET_LIST_SELECT = {
  id: true,
  site: true,
  deployment: true,
  recordingDatetime: true,
} as const satisfies Prisma.SnippetSelect;

/** The public view of one clip. */
export const PUBLIC_SNIPPET_SELECT = {
  id: true,
  site: true,
  deployment: true,
  depthM: true,
  lat: true,
  lon: true,
  recordingDatetime: true,
} as const satisfies Prisma.SnippetSelect;

/**
 * Fields that must never reach a public caller. The route tests check the
 * selects above against this list, so adding one of these to a select fails.
 */
export const NEVER_PUBLIC_SNIPPET_FIELDS = [
  "externalId",
  "videoUrl",
  "videoUrlSd",
  "thumbnailUrl",
  "staffAnswer",
  "bboxJson",
  "manualTrackJson",
] as const;

/**
 * The answer differs by who is asking, so no shared cache may keep it: a CDN
 * keys on the URL, and would otherwise serve a staff response to the public.
 */
export const SNIPPET_API_HEADERS = { "Cache-Control": "private, no-store" } as const;
