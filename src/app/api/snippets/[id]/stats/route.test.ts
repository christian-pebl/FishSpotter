// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Blind submission, pinned through the real handler.
 *
 * The crowd is the authority on this app, so the community histogram is the
 * answer. Until 11 Nov 2026 this route returned it to anyone who asked, signed
 * in or not, and marked that response publicly cacheable. These tests hold the
 * two halves of the fix: the histogram goes only to a spotter who has already
 * answered this clip, and no response from this route may be stored by a
 * shared cache (the CDN keys on the URL, not on who is asking).
 */

const session = vi.hoisted(() => ({
  current: null as null | { user: { id?: string } },
}));
const prismaMock = vi.hoisted(() => ({
  snippet: { findUnique: vi.fn() },
  answer: { findFirst: vi.fn(), findMany: vi.fn() },
}));

vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => session.current) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { GET } from "./route";

const SNIPPET_ID = "clip1";

/** Seven answers on the clip: six agree, one does not. */
const CROWD = [
  ...Array.from({ length: 6 }, () => ({ chosenOption: "Ballan wrasse", isCorrect: null })),
  { chosenOption: "Crab", isCorrect: null },
];

function get(id = SNIPPET_ID) {
  return GET(new Request(`https://www.fishspotter.app/api/snippets/${id}/stats`), {
    params: Promise.resolve({ id }),
  });
}

/** True when a shared cache (CDN, proxy) is allowed to keep this response. */
function sharedCacheMayStore(res: Response): boolean {
  const cc = (res.headers.get("cache-control") ?? "").toLowerCase();
  if (cc.includes("no-store") || cc.includes("private")) return false;
  return true;
}

describe("GET /api/snippets/[id]/stats", () => {
  beforeEach(() => {
    session.current = null;
    prismaMock.snippet.findUnique.mockResolvedValue({ id: SNIPPET_ID });
    prismaMock.answer.findFirst.mockResolvedValue(null);
    prismaMock.answer.findMany.mockResolvedValue(CROWD);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("gives a signed-out visitor no histogram, and never reads the database", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ gated: true, total: 0, stats: [] });
    // The leak was the species name itself, so check the raw body too.
    expect(text).not.toContain("wrasse");
    expect(text).not.toContain("consensus");

    expect(prismaMock.snippet.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.answer.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.answer.findMany).not.toHaveBeenCalled();
  });

  it("gives a signed-in spotter who has NOT answered this clip no histogram", async () => {
    session.current = { user: { id: "u1" } };
    const res = await get();
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ gated: true, total: 0, stats: [] });
    expect(text).not.toContain("wrasse");

    // The gate asked about THIS spotter on THIS clip...
    expect(prismaMock.answer.findFirst).toHaveBeenCalledWith({
      where: { userId: "u1", snippetId: SNIPPET_ID },
      select: { id: true },
    });
    // ...and the crowd's answers were never loaded.
    expect(prismaMock.answer.findMany).not.toHaveBeenCalled();
  });

  it("treats a session with no user id as signed out", async () => {
    session.current = { user: {} };
    const res = await get();
    expect(await res.json()).toEqual({ gated: true, total: 0, stats: [] });
    expect(prismaMock.answer.findMany).not.toHaveBeenCalled();
  });

  it("gives a spotter who has answered the histogram and the consensus state", async () => {
    session.current = { user: { id: "u1" } };
    prismaMock.answer.findFirst.mockResolvedValue({ id: "a1" });

    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.gated).toBeUndefined();
    expect(body.total).toBe(7);
    expect(body.stats).toEqual([
      { option: "Ballan wrasse", count: 6, percent: 86 },
      { option: "Crab", count: 1, percent: 14 },
    ]);
    expect(body.hasReference).toBe(false);
    expect(body.consensus).toMatchObject({
      spotters: 7,
      leader: { option: "Ballan wrasse", users: 6 },
    });
  });

  it("answers 404 for a clip that does not exist, to a signed-in spotter", async () => {
    session.current = { user: { id: "u1" } };
    prismaMock.snippet.findUnique.mockResolvedValue(null);
    prismaMock.answer.findFirst.mockResolvedValue({ id: "a1" });

    const res = await get("nope");
    expect(res.status).toBe(404);
    expect(prismaMock.answer.findMany).not.toHaveBeenCalled();
  });

  it("never lets a shared cache store any response", async () => {
    // Signed out.
    expect(sharedCacheMayStore(await get())).toBe(false);

    // Signed in, not answered.
    session.current = { user: { id: "u1" } };
    expect(sharedCacheMayStore(await get())).toBe(false);

    // Signed in, answered: this is the response that carries the histogram.
    prismaMock.answer.findFirst.mockResolvedValue({ id: "a1" });
    const answered = await get();
    expect(sharedCacheMayStore(answered)).toBe(false);
    expect(answered.headers.get("cache-control")).toBe("private, no-store");

    // Not found.
    prismaMock.snippet.findUnique.mockResolvedValue(null);
    expect(sharedCacheMayStore(await get("nope"))).toBe(false);
  });
});
