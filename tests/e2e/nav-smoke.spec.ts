import { expect, test } from "@playwright/test";

const PUBLIC_ROUTES = [
  { path: "/", title: /FishSpotter/i },
  { path: "/feed", title: /FishSpotter/i },
  { path: "/feed/browse", title: /FishSpotter/i },
  { path: "/leaderboard", title: /FishSpotter/i },
  { path: "/auth/signin", title: /FishSpotter/i },
] as const;

for (const route of PUBLIC_ROUTES) {
  test(`smoke: ${route.path} renders without console errors`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    const response = await page.goto(route.path);
    expect(response?.status(), `${route.path} should return 2xx`).toBeLessThan(400);
    await expect(page).toHaveTitle(route.title);
    // <main id="main" tabIndex={-1}> exists everywhere
    await expect(page.locator("main#main")).toHaveCount(1);
    // No serious console errors. Filter out noise from third-party SDKs.
    const real = consoleErrors.filter(
      (e) => !/Failed to load resource/.test(e) && !/manifest/i.test(e),
    );
    expect(real, `${route.path} produced console errors`).toEqual([]);
  });
}

test("404: unmatched route shows branded not-found", async ({ page }) => {
  const response = await page.goto("/this-route-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByText(/Page not found/i)).toBeVisible();
});

test("skip-link moves focus into <main>", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab"); // skip link is the first focusable
  const focusedHrefBefore = await page.evaluate(() =>
    (document.activeElement as HTMLAnchorElement | null)?.getAttribute("href"),
  );
  expect(focusedHrefBefore).toBe("#main");
  await page.keyboard.press("Enter");
  // After Enter on the skip link, focus should be inside <main>
  const focusInsideMain = await page.evaluate(() => {
    const main = document.getElementById("main");
    return !!main && (main === document.activeElement || main.contains(document.activeElement));
  });
  expect(focusInsideMain).toBe(true);
});
