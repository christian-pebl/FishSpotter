// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The public snippet API must not say what is in a clip.
 *
 * Until 12 Nov 2026 `GET /api/snippets` returned every clip's export folder
 * name and media URLs to anyone, and `GET /api/snippets/[id]` returned the
 * whole row. 56 of 139 folder names carry a species label, and the row carried
 * `staffAnswer`. These tests run the real handlers against a database double
 * that behaves like Prisma: it returns only the columns the `select` asks for,
 * or every column when there is no `select`. So a handler that reads too much
 * fails here the same way it would leak in production.
 */

const admin = vi.hoisted(() => ({ current: null as null | { email: string } }));
const prismaMock = vi.hoisted(() => ({
  snippet: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
}));

vi.mock("@/lib/admin", () => ({ getAdminSession: vi.fn(async () => admin.current) }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { GET as getList } from "./route";
import { GET as getOne } from "./[id]/route";
import {
  NEVER_PUBLIC_SNIPPET_FIELDS,
  PUBLIC_SNIPPET_LIST_SELECT,
  PUBLIC_SNIPPET_SELECT,
} from "@/lib/snippet-public";

const EXTERNAL_ID = "CYM_Farm_S_2026-06-15_08-00_wrasse00007270_track_manual_86-353_20260828_094841";
const BUCKET = "https://aazxphcrexkggbmmceli.supabase.co/storage/v1/object/public/snippets";

/** A full database row, as Prisma returns it with no `select`. */
const ROW = {
  id: "clip1",
  externalId: EXTERNAL_ID,
  videoUrl: `${BUCKET}/${EXTERNAL_ID}/snippet.mp4?v=4`,
  videoUrlSd: `${BUCKET}/${EXTERNAL_ID}/snippet_720.mp4?v=1`,
  thumbnailUrl: `${BUCKET}/${EXTERNAL_ID}/thumbnail.jpg?v=3`,
  site: "Ramsey Sound",
  deployment: "CYM_Farm_S",
  depthM: 6,
  lat: 51.87,
  lon: -5.32,
  recordingDatetime: "2026-06-15T08:00:00",
  staffAnswer: "Fish",
  bboxJson: JSON.stringify([{ frame: 1, x: 10, y: 20, w: 30, h: 40 }]),
  manualTrackJson: JSON.stringify([{ frame: 1, x: 25, y: 40 }]),
  excluded: false,
  difficultyScore: 0.4,
  createdAt: new Date("2026-08-28T09:48:41Z"),
};

/** Behaves like Prisma: only the selected columns come back. */
function project(row: Record<string, unknown>, select?: Record<string, boolean>) {
  if (!select) return { ...row };
  return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, row[k]]));
}

function one(id = ROW.id) {
  return getOne(new Request(`https://www.fishspotter.app/api/snippets/${id}`), {
    params: Promise.resolve({ id }),
  });
}

/** Every string a public response must not contain. */
const SECRETS = [EXTERNAL_ID, "wrasse", "snippet.mp4", "thumbnail.jpg", "supabase.co", "staffAnswer", "externalId"];

function expectNoSecrets(text: string) {
  for (const secret of SECRETS) expect(text, `response leaks "${secret}"`).not.toContain(secret);
}

function sharedCacheMayStore(res: Response): boolean {
  const cc = (res.headers.get("cache-control") ?? "").toLowerCase();
  return !(cc.includes("no-store") || cc.includes("private"));
}

beforeEach(() => {
  admin.current = null;
  prismaMock.snippet.findMany.mockImplementation(async (args: { select?: Record<string, boolean> }) => [
    project(ROW, args?.select),
  ]);
  prismaMock.snippet.findFirst.mockImplementation(async (args: { select?: Record<string, boolean> }) =>
    project(ROW, args?.select),
  );
  prismaMock.snippet.findUnique.mockImplementation(async (args: { select?: Record<string, boolean> }) =>
    project(ROW, args?.select),
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("the public selects", () => {
  it("never name a field that identifies a clip", () => {
    for (const field of NEVER_PUBLIC_SNIPPET_FIELDS) {
      expect(Object.keys(PUBLIC_SNIPPET_LIST_SELECT)).not.toContain(field);
      expect(Object.keys(PUBLIC_SNIPPET_SELECT)).not.toContain(field);
    }
  });
});

describe("GET /api/snippets", () => {
  it("gives a signed-out visitor where and when, and nothing that names the clip", async () => {
    const res = await getList();
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual([
      {
        id: "clip1",
        site: "Ramsey Sound",
        deployment: "CYM_Farm_S",
        recordingDatetime: "2026-06-15T08:00:00",
      },
    ]);
    expectNoSecrets(text);
  });

  it("does not even read the identifying columns for a public caller", async () => {
    await getList();
    const select = prismaMock.snippet.findMany.mock.calls[0][0].select as Record<string, boolean>;
    for (const field of NEVER_PUBLIC_SNIPPET_FIELDS) expect(select[field]).toBeUndefined();
  });

  it("still hides excluded and blocklisted clips", async () => {
    await getList();
    const where = prismaMock.snippet.findMany.mock.calls[0][0].where;
    expect(where.excluded).toBe(false);
    expect(where.externalId.notIn.length).toBeGreaterThan(0);
  });

  it("gives PEBL staff the folder name and media URLs", async () => {
    admin.current = { email: "someone@pebl-cic.co.uk" };
    const [row] = (await (await getList()).json()) as Record<string, unknown>[];
    expect(row.externalId).toBe(EXTERNAL_ID);
    expect(row.videoUrl).toBe(ROW.videoUrl);
    expect(row.thumbnailUrl).toBe(ROW.thumbnailUrl);
  });

  it("is never stored by a shared cache, for either caller", async () => {
    expect(sharedCacheMayStore(await getList())).toBe(false);
    admin.current = { email: "someone@pebl-cic.co.uk" };
    expect(sharedCacheMayStore(await getList())).toBe(false);
  });
});

describe("GET /api/snippets/[id]", () => {
  it("gives a signed-out visitor where and when, not the row", async () => {
    const res = await one();
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({
      id: "clip1",
      site: "Ramsey Sound",
      deployment: "CYM_Farm_S",
      depthM: 6,
      lat: 51.87,
      lon: -5.32,
      recordingDatetime: "2026-06-15T08:00:00",
    });
    expectNoSecrets(text);
    // The tracking overlay has its own route; it is not part of this answer.
    expect(text).not.toContain("bboxes");
    expect(text).not.toContain("manualTrack");
  });

  it("reads only the public columns, and only a clip that is not hidden", async () => {
    await one();
    expect(prismaMock.snippet.findUnique).not.toHaveBeenCalled();
    const args = prismaMock.snippet.findFirst.mock.calls[0][0];
    for (const field of NEVER_PUBLIC_SNIPPET_FIELDS) expect(args.select[field]).toBeUndefined();
    expect(args.where.id).toBe("clip1");
    expect(args.where.excluded).toBe(false);
  });

  it("answers 404 for a clip that does not exist or is hidden", async () => {
    prismaMock.snippet.findFirst.mockResolvedValue(null);
    const res = await one("nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });

  it("gives PEBL staff the full row with parsed tracks", async () => {
    admin.current = { email: "someone@pebl-cic.co.uk" };
    const body = (await (await one()).json()) as Record<string, unknown>;
    expect(body.externalId).toBe(EXTERNAL_ID);
    expect(body.staffAnswer).toBe("Fish");
    expect(body.bboxes).toEqual([{ frame: 1, x: 10, y: 20, w: 30, h: 40 }]);
    expect(body.manualTrack).toEqual([{ frame: 1, x: 25, y: 40 }]);
    expect(body).not.toHaveProperty("bboxJson");
  });

  it("does not crash on a malformed track, even for staff", async () => {
    admin.current = { email: "someone@pebl-cic.co.uk" };
    prismaMock.snippet.findUnique.mockResolvedValue({ ...ROW, bboxJson: "{not json" });
    const res = await one();
    expect(res.status).toBe(200);
    expect(((await res.json()) as { bboxes: unknown }).bboxes).toBeNull();
  });

  it("is never stored by a shared cache, for either caller", async () => {
    expect(sharedCacheMayStore(await one())).toBe(false);
    admin.current = { email: "someone@pebl-cic.co.uk" };
    expect(sharedCacheMayStore(await one())).toBe(false);
  });
});
