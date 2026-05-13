import { test, expect } from "@playwright/test";

test.describe("Snippets API", () => {
  test("GET /api/snippets returns clips with expected fields", async ({ request }) => {
    const r = await request.get("/api/snippets");
    expect(r.ok()).toBe(true);
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(20);

    const sample = list[0];
    for (const k of [
      "id",
      "externalId",
      "videoUrl",
      "thumbnailUrl",
      "site",
      "deployment",
      "labelStatus",
    ]) {
      expect(sample).toHaveProperty(k);
    }
    // labelStatus is one of two enums
    for (const s of list) {
      expect(["STAFF_LABELLED", "UNLABELLED"]).toContain(s.labelStatus);
    }
  });

  test("at least one verified and one unlabelled clip exist (so reveal-panel states can be tested)", async ({
    request,
  }) => {
    const r = await request.get("/api/snippets");
    const list = await r.json();
    const verified = list.filter((s: any) => s.labelStatus === "STAFF_LABELLED");
    const unlabelled = list.filter((s: any) => s.labelStatus === "UNLABELLED");
    expect(verified.length).toBeGreaterThan(0);
    expect(unlabelled.length).toBeGreaterThan(0);
  });

  test("GET /api/snippets/[id]/stats returns label state and stats array", async ({ request }) => {
    const list = await (await request.get("/api/snippets")).json();
    const r = await request.get(`/api/snippets/${list[0].id}/stats`);
    expect(r.ok()).toBe(true);
    const stats = await r.json();
    expect(stats).toHaveProperty("total");
    expect(stats).toHaveProperty("labelStatus");
    expect(Array.isArray(stats.stats)).toBe(true);
  });
});
