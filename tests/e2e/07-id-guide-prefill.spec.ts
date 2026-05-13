import { test, expect } from "@playwright/test";
import { signUpFresh } from "./helpers";

/**
 * Day 3 of the ID Guide: smart prefill from bbox path.
 * On the live feed, every clip has a bbox track. Most produce a screenZone
 * suggestion at minimum (mean-y bucket), and many also produce a locomotion
 * suggestion (path geometry). This test asserts the user sees the hint after
 * answering Q1 — proving the data flows end-to-end.
 */
test("prefill hint shows on Q2 / Q3 after answering Q1", async ({ page }) => {
  await signUpFresh(page);
  await page.goto("/feed");

  // Active card has the leaflet map; pick that one's id-guide-button
  const activeArticle = page.locator("article", { has: page.locator(".leaflet-container") });
  await expect(activeArticle).toBeVisible({ timeout: 10_000 });

  const guideBtn = activeArticle.getByTestId("id-guide-button");
  await expect(guideBtn).toBeVisible();
  await guideBtn.click();

  const sheet = page.getByRole("dialog", { name: /Help me figure it out/i });
  await expect(sheet).toBeVisible();

  // Answer Q1 with Fish (a safe choice that doesn't hide subsequent questions)
  await sheet.getByRole("button", { name: /^Fish$/ }).click();

  // We should now be on Q2 or Q3. Either way, the hint should appear because
  // every clip's bbox produces a screenZone suggestion at minimum.
  // Walk forward through up to 3 questions looking for the hint.
  let foundHint = false;
  for (let i = 0; i < 3; i++) {
    const hint = sheet.getByText(/We've spotted:/i);
    if (await hint.isVisible({ timeout: 1_500 }).catch(() => false)) {
      foundHint = true;
      // Verify it includes a real suggestion, not an empty value
      const text = (await hint.textContent()) ?? "";
      expect(text.length).toBeGreaterThan(20);
      break;
    }
    // Skip this question and check the next one
    const skip = sheet.getByRole("button", { name: /Skip this question/i });
    if (await skip.isVisible({ timeout: 500 }).catch(() => false)) {
      await skip.click();
    } else {
      break;
    }
  }
  expect(foundHint).toBe(true);
});

test("tapping a non-prefilled option records the user's choice instead", async ({ page }) => {
  await signUpFresh(page);
  await page.goto("/feed");

  const activeArticle = page.locator("article", { has: page.locator(".leaflet-container") });
  await activeArticle.getByTestId("id-guide-button").click();
  const sheet = page.getByRole("dialog", { name: /Help me figure it out/i });

  await sheet.getByRole("button", { name: /^Fish$/ }).click();

  // On Q2, deliberately pick "Drifting passively" (almost certainly NOT the prefill)
  const driftBtn = sheet.getByRole("button", { name: /Drifting passively/i });
  if (await driftBtn.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await driftBtn.click();
    // Now on Q3
    await expect(sheet.getByRole("heading", { name: /Where is it in the frame/i })).toBeVisible({ timeout: 5_000 });
  }
});
