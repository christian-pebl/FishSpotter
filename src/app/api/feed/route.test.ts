// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * GET /api/feed is public and unauthenticated, so it must not hand out any clip's
 * reference identification (`staffAnswer`). Measured on production on 12 Nov
 * 2026: `?take=5` returned it for every row, signed out. The mock below behaves
 * like the database: it returns only the columns the route's `select` asks for,
 * so the test fails if the route ever selects `staffAnswer` again.
 */

const prismaMock = vi.hoisted(() => ({
  snippet: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { GET } from "./route";

const REFERENCE = "Velvet crab";

const ROWS = Array.from({ length: 5 }, (_, i) => ({
  id: `clip${i}`,
  videoUrl: `https://media.example/clip${i}.mp4`,
  videoUrlSd: null,
  thumbnailUrl: `https://media.example/clip${i}.jpg`,
  site: "SITE",
  deployment: "D1",
  staffAnswer: REFERENCE,
  lat: 51.5,
  lon: -3.1,
  depthM: 4,
  recordingDatetime: "2026-08-01T10:00:00Z",
}));

describe("GET /api/feed", () => {
  beforeEach(() => {
    prismaMock.snippet.findMany.mockImplementation(
      async ({ select }: { select: Record<string, boolean> }) =>
        ROWS.map((row) =>
          Object.fromEntries(
            Object.keys(select).map((k) => [k, (row as Record<string, unknown>)[k]]),
          ),
        ),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns clips with no reference identification", async () => {
    const res = await GET(new Request("https://www.fishspotter.app/api/feed?take=5"));
    expect(res.status).toBe(200);
    const text = await res.text();
    const body = JSON.parse(text);

    expect(body.snippets).toHaveLength(5);
    for (const row of body.snippets) {
      expect(row).not.toHaveProperty("staffAnswer");
      expect(row.id).toMatch(/^clip/);
    }
    expect(text).not.toContain("staffAnswer");
    expect(text).not.toContain(REFERENCE);
  });

  it("does not select the reference identification", async () => {
    await GET(new Request("https://www.fishspotter.app/api/feed"));
    const arg = prismaMock.snippet.findMany.mock.calls[0][0] as {
      select: Record<string, boolean>;
    };
    expect(arg.select).not.toHaveProperty("staffAnswer");
  });
});
