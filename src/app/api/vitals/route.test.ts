// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/vitals must store a rating with every sample. Until 24 Nov 2026 it
 * stored none, so all 466 rows in production had `rating` null and the stats
 * roundup reported "good 0 of N" for every metric.
 */

const prismaMock = vi.hoisted(() => ({
  vital: { create: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/csrf", () => ({ assertSameOrigin: vi.fn(() => true) }));
vi.mock("@/lib/rate-limit", () => ({ checkVitalsRateLimit: vi.fn(async () => true) }));

import { POST } from "./route";

function post(body: Record<string, unknown>) {
  return POST(
    new Request("https://www.fishspotter.app/api/vitals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "v5-123", path: "/", ...body }),
    }),
  );
}

function stored() {
  expect(prismaMock.vital.create).toHaveBeenCalledTimes(1);
  return prismaMock.vital.create.mock.calls[0][0].data;
}

describe("POST /api/vitals", () => {
  beforeEach(() => {
    prismaMock.vital.create.mockResolvedValue({});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("stores the rating web-vitals sent", async () => {
    const res = await post({ name: "LCP", value: 1800, rating: "good" });
    expect(res.status).toBe(204);
    expect(stored()).toMatchObject({ name: "LCP", value: 1800, rating: "good" });
  });

  it("rates a sample from a bundle that predates the rating field", async () => {
    await post({ name: "INP", value: 256 });
    expect(stored().rating).toBe("needs-improvement");
  });

  it("stores a rating that agrees with the value, whatever the client claims", async () => {
    await post({ name: "CLS", value: 0.4, rating: "good" });
    expect(stored().rating).toBe("poor");
  });

  it("keeps the client's rating for a metric it has no bands for", async () => {
    await post({ name: "FID", value: 12, rating: "good" });
    expect(stored().rating).toBe("good");
  });

  it("stores null for an unknown metric sent without a rating", async () => {
    await post({ name: "FID", value: 12 });
    expect(stored().rating).toBeNull();
  });

  it("rejects a rating outside web-vitals' three bands", async () => {
    const res = await post({ name: "LCP", value: 1800, rating: "excellent" });
    expect(res.status).toBe(400);
    expect(prismaMock.vital.create).not.toHaveBeenCalled();
  });
});
