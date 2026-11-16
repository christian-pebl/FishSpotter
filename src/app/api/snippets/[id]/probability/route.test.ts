// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * GET /api/snippets/[id]/probability is the PUBLIC, edge-cached payload and
 * nothing else.
 *
 * Measured on production on 16 Nov 2026: the edge keys this route on the URL
 * alone. A request carrying a session cookie got the same cached anonymous copy
 * (`X-Vercel-Cache: HIT`), so the route could never deliver a per-user value to
 * a signed-in spotter. It used to try: after an answer it added
 * `staffAnswerScientific`, and the reveal's species gallery waited for it
 * forever. That name now comes from GET /stats. These tests pin the route to
 * its one job, and keep the reference identification out of it for good.
 */

const prismaMock = vi.hoisted(() => ({
  snippet: { findUnique: vi.fn() },
  speciesProbability: { findUnique: vi.fn() },
  speciesNameMap: { findUnique: vi.fn() },
  answer: { findFirst: vi.fn() },
}));
const sessionMock = vi.hoisted(() => ({ getServerSession: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next-auth", () => sessionMock);
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { GET } from "./route";

const SNIPPET = {
  id: "clip1",
  lat: 51.87,
  lon: -5.32,
  depthM: 6,
  recordingDatetime: "2026-06-15T08:00:00",
};

const CACHED = {
  status: "OK",
  source: "obis",
  totalRecords: 142,
  speciesJson: JSON.stringify([{ scientificName: "Pollachius pollachius", count: 12, probability: 0.08 }]),
  errorMessage: null,
  fetchedAt: new Date("2026-10-01T00:00:00Z"),
};

function get(id = "clip1") {
  return GET(new Request(`https://www.fishspotter.app/api/snippets/${id}/probability`), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  prismaMock.snippet.findUnique.mockResolvedValue({ ...SNIPPET });
  prismaMock.speciesProbability.findUnique.mockResolvedValue({ ...CACHED });
  sessionMock.getServerSession.mockResolvedValue({ user: { id: "u1" } });
  prismaMock.answer.findFirst.mockResolvedValue({ id: "a1" });
  prismaMock.speciesNameMap.findUnique.mockResolvedValue({ scientificName: "Necora puber" });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/snippets/[id]/probability", () => {
  it("returns the shared probability payload with the public cache header", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("public");
    expect(res.headers.get("cache-control")).toContain("s-maxage=3600");
    const body = await res.json();
    expect(body).toMatchObject({ status: "OK", source: "obis", totalRecords: 142 });
    expect(body.species).toEqual([{ scientificName: "Pollachius pollachius", count: 12, probability: 0.08 }]);
  });

  it("is identical for a signed-in spotter who has answered: no reference, same header", async () => {
    // The edge would serve everyone the same copy anyway; the route must not
    // pretend otherwise, and must not put a per-user value in a public response.
    const signedIn = await get();
    const signedInText = await signedIn.text();

    sessionMock.getServerSession.mockResolvedValue(null);
    prismaMock.answer.findFirst.mockResolvedValue(null);
    const anonymous = await get();
    const anonymousText = await anonymous.text();

    expect(signedInText).toBe(anonymousText);
    expect(signedIn.headers.get("cache-control")).toBe(anonymous.headers.get("cache-control"));
    for (const text of [signedInText, anonymousText]) {
      expect(text).not.toContain("staffAnswer");
      expect(text).not.toContain("Necora");
    }
  });

  it("does not read the session, the answers or the clip's reference at all", async () => {
    await get();
    expect(sessionMock.getServerSession).not.toHaveBeenCalled();
    expect(prismaMock.answer.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.speciesNameMap.findUnique).not.toHaveBeenCalled();
    const select = prismaMock.snippet.findUnique.mock.calls[0][0].select as Record<string, boolean>;
    expect(select.staffAnswer).toBeUndefined();
  });

  it("gives every no-data outcome the public header and no reference", async () => {
    prismaMock.speciesProbability.findUnique.mockResolvedValue(null);
    let res = await get();
    expect(await res.json()).toEqual({ status: "INSUFFICIENT_DATA" });
    expect(res.headers.get("cache-control")).toContain("public");

    prismaMock.speciesProbability.findUnique.mockResolvedValue({ ...CACHED, status: "ERROR", errorMessage: "OBIS down" });
    res = await get();
    expect(await res.json()).toEqual({ status: "ERROR", errorMessage: "OBIS down" });

    prismaMock.speciesProbability.findUnique.mockResolvedValue({ ...CACHED, status: "INSUFFICIENT_DATA" });
    res = await get();
    expect(await res.json()).toEqual({ status: "INSUFFICIENT_DATA" });
  });

  it("answers 404 for an unknown clip", async () => {
    prismaMock.snippet.findUnique.mockResolvedValue(null);
    const res = await get("nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });
});
