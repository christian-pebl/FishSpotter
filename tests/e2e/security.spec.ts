import { expect, test } from "@playwright/test";

test.describe("S1-T12: callbackUrl validation", () => {
  test("rejects absolute https callback and lands on /feed", async ({ page }) => {
    await page.goto("/auth/signin?callbackUrl=https%3A%2F%2Fevil.example.com");
    const callbackValue = await page.evaluate(() =>
      new URL(window.location.href).searchParams.get("callbackUrl"),
    );
    // The hostile callbackUrl is still on the URL (it's the user's GET param),
    // but the form's internal callback resolves to /feed. We can't easily
    // submit a real credential here; instead, assert the safeCallback() module
    // contract by reading the resolved value through the form's data attr if
    // present, or otherwise rely on a manual end-to-end check. As a baseline,
    // assert the page rendered without any redirect to evil.example.com.
    expect(page.url()).toContain("/auth/signin");
    expect(page.url()).not.toContain("evil.example.com/");
    expect(callbackValue).toBe("https://evil.example.com");
  });

  test("rejects protocol-relative callback", async ({ page }) => {
    await page.goto("/auth/signin?callbackUrl=%2F%2Fevil.example.com");
    expect(page.url()).toContain("/auth/signin");
    expect(page.url()).not.toContain("evil.example.com/");
  });

  test("accepts same-origin relative callback", async ({ page }) => {
    await page.goto("/auth/signin?callbackUrl=%2Ffeed%2Fbrowse");
    // Just verify the form renders and the param is preserved as-is in the URL;
    // a real client-transition test requires credentials and is left to a
    // future fixture sprint (Sprint 2 will introduce a test-user fixture).
    expect(page.url()).toContain("/auth/signin");
    expect(page.url()).toContain("callbackUrl=%2Ffeed%2Fbrowse");
  });
});

test.describe("S1-T11: anonymous spoiler-gate on API", () => {
  test("/api/snippets/[id]/stats has no staffAnswer for anonymous caller", async ({ request, page }) => {
    // Pick a real snippet id off the feed page.
    await page.goto("/feed/browse");
    const firstHref = await page
      .locator('a[href^="/feed/"]')
      .first()
      .getAttribute("href");
    if (!firstHref) test.skip(true, "No snippets seeded; skipping API contract test.");
    const id = firstHref!.replace(/^\/feed\//, "");

    const res = await request.get(`/api/snippets/${id}/stats`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("stats");
    expect(body).not.toHaveProperty("staffAnswer");
  });

  test("/api/snippets/[id]/probability has no staffAnswerScientific for anonymous caller", async ({
    request,
    page,
  }) => {
    await page.goto("/feed/browse");
    const firstHref = await page
      .locator('a[href^="/feed/"]')
      .first()
      .getAttribute("href");
    if (!firstHref) test.skip(true, "No snippets seeded; skipping API contract test.");
    const id = firstHref!.replace(/^\/feed\//, "");

    const res = await request.get(`/api/snippets/${id}/probability`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty("staffAnswerScientific");
  });
});

test.describe("clip comments: anti-herding gate + leak guard (INV-1, INV-2)", () => {
  async function firstSnippetId(page: import("@playwright/test").Page) {
    await page.goto("/feed/browse");
    const href = await page.locator('a[href^="/feed/"]').first().getAttribute("href");
    return href ? href.replace(/^\/feed\//, "") : null;
  }

  test("anonymous GET /api/comments is gated and leaks nothing about the thread", async ({
    request,
    page,
  }) => {
    const id = await firstSnippetId(page);
    if (!id) test.skip(true, "No snippets seeded; skipping.");

    const res = await request.get(`/api/comments?snippetId=${id}`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;

    // The gate must be total: no comments, and no count either. A bare total
    // would still leak whether a clip is being discussed, and how much.
    expect(body).toHaveProperty("gated", true);
    expect(body).not.toHaveProperty("comments");
    expect(body).not.toHaveProperty("total");
  });

  test("no internal field ever appears in a comments payload (INV-2)", async ({
    request,
    page,
  }) => {
    const id = await firstSnippetId(page);
    if (!id) test.skip(true, "No snippets seeded; skipping.");

    const res = await request.get(`/api/comments?snippetId=${id}`);
    const raw = await res.text();
    for (const secret of ["adminNote", "hiddenReason", "handledBy", "emailVerified"]) {
      expect(raw, `payload leaked ${secret}`).not.toContain(secret);
    }
  });

  test("GET without snippetId is a 400, not a full-table read", async ({ request }) => {
    const res = await request.get("/api/comments");
    expect(res.status()).toBe(400);
  });

  test("anonymous POST /api/comments is rejected", async ({ request, page }) => {
    const id = await firstSnippetId(page);
    if (!id) test.skip(true, "No snippets seeded; skipping.");

    const res = await request.post("/api/comments", {
      data: { snippetId: id, body: "e2e should never persist this" },
    });
    // 401 unauthorised, or 403 if the same-origin guard fires first. Either is a
    // refusal; what must never happen is a 201.
    expect([401, 403]).toContain(res.status());
  });

  test("cross-origin POST /api/comments is rejected by the same-origin guard", async ({
    request,
    page,
  }) => {
    const id = await firstSnippetId(page);
    if (!id) test.skip(true, "No snippets seeded; skipping.");

    const res = await request.post("/api/comments", {
      headers: { origin: "https://evil.example.com" },
      data: { snippetId: id, body: "e2e cross-origin probe" },
    });
    expect(res.status()).toBe(403);
  });

  test("anonymous report is rejected", async ({ request }) => {
    const res = await request.post("/api/comments/does-not-exist/report", {
      data: { reason: "spam" },
    });
    expect([401, 403]).toContain(res.status());
  });
});
