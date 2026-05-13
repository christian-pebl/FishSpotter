import { test, expect } from "@playwright/test";
import { signUpFresh } from "./helpers";

test.describe("Feed page", () => {
  test("logged-in feed shows clips, badges, place context, map", async ({ page }) => {
    await signUpFresh(page);
    await page.goto("/feed");

    // The first card has the badge + place context
    const firstArticle = page.locator("article").first();
    await expect(firstArticle).toBeVisible();

    // Badge: either Verified or Help us ID
    const badge = firstArticle.locator("text=/(Verified|Help us ID)/").first();
    await expect(badge).toBeVisible();

    // Place context contains "Bideford Bay"
    await expect(firstArticle.getByText(/BIDEFORD BAY/i)).toBeVisible();

    // Leaflet map present (one container per active card)
    await expect(page.locator(".leaflet-container").first()).toBeVisible({ timeout: 10_000 });
  });

  test("'My taxa' link navigates to life list", async ({ page }) => {
    await signUpFresh(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/feed");
    // Wait for session to settle (My taxa link is conditionally rendered when session exists)
    const link = page.getByRole("link", { name: /My taxa/i });
    await expect(link).toBeVisible({ timeout: 10_000 });
    // Wait for the click to actually navigate
    await Promise.all([
      page.waitForURL(/\/me\/taxa/, { timeout: 10_000 }),
      link.click(),
    ]);
    await expect(page.getByRole("heading", { name: /Life list/i })).toBeVisible();
  });

  test("tracker toggle persists across reload", async ({ page }) => {
    await signUpFresh(page);
    await page.goto("/feed");
    // Use the first article's toggle specifically — the snap-scroll feed may render many cards
    const firstArticle = page.locator("article").first();
    const toggle = firstArticle.getByRole("button", { name: /Show tracker/i });
    await expect(toggle).toBeVisible({ timeout: 10_000 });
    await expect(toggle).toHaveAttribute("aria-pressed", "true");

    // Click + wait for state to flip
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false", { timeout: 4_000 });

    // localStorage should have persisted the off state
    await expect
      .poll(async () => page.evaluate(() => localStorage.getItem("fishspotter:trackingOn")), { timeout: 4_000 })
      .toBe("0");

    // Reload — should still be off
    await page.reload();
    const toggleAfter = page.locator("article").first().getByRole("button", { name: /Show tracker/i });
    await expect(toggleAfter).toBeVisible({ timeout: 10_000 });
    await expect(toggleAfter).toHaveAttribute("aria-pressed", "false");
  });
});
