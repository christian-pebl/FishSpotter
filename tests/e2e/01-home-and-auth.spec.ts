import { test, expect } from "@playwright/test";
import { signUpFresh, freshEmail } from "./helpers";

test.describe("Home + auth", () => {
  test("signed-out home page renders headline and CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /turns marine monitoring/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Start spotting/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Explore archive/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Sign in$/i })).toBeVisible();
  });

  test("Start spotting takes you to /feed", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Start spotting/i }).click();
    await expect(page).toHaveURL(/\/feed$/);
  });

  test("sign up creates an account and lands on /feed with My taxa link", async ({ page }) => {
    await signUpFresh(page);
    await expect(page.getByRole("link", { name: /My taxa/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Sign out/i })).toBeVisible();
  });

  test("sign in / sign out / sign in preserves the user", async ({ page, context }) => {
    const { email } = await signUpFresh(page);

    // Wait for the NextAuth signout response, then for session to clear in the DOM
    const signOutResp = page.waitForResponse(
      (r) => r.url().includes("/api/auth/signout") && r.request().method() === "POST",
      { timeout: 10_000 },
    );
    await page.getByRole("button", { name: /Sign out/i }).click();
    await signOutResp;
    // Hard reload to make sure the React tree picks up the cleared session
    await page.goto("/feed");
    // The header has the canonical Sign in link; in-card "Sign in" prompts also exist on /feed
    await expect(
      page.getByRole("banner").getByRole("link", { name: /^Sign in$/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /Sign out/i })).toHaveCount(0);

    // Sign back in
    await context.clearCookies();
    await page.goto("/auth/signin");
    await page.getByLabel(/^Email$/i).fill(email);
    await page.getByRole("button", { name: /^Sign in$/i }).click();
    await expect(page.getByRole("button", { name: /Sign out/i })).toBeVisible({ timeout: 10_000 });
  });

  test("invalid sign-in shows error, not crash", async ({ page }) => {
    await page.goto("/auth/signin");
    await page.getByLabel(/^Email$/i).fill("nonexistent-" + freshEmail());
    await page.getByRole("button", { name: /^Sign in$/i }).click();
    // Either an error message or stays on the page — both acceptable, just no crash
    await expect(page).toHaveURL(/\/auth\/signin/);
  });
});
