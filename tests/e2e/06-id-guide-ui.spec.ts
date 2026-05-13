import { test, expect } from "@playwright/test";
import { signUpFresh, findClipByStatus } from "./helpers";

test.describe("ID Guide — entry + navigation", () => {
  test("Help-me-figure-it-out button opens the sheet on a verified clip", async ({ page, request }) => {
    await signUpFresh(page);
    const clip = await findClipByStatus(request, "STAFF_LABELLED");
    await page.goto(`/feed/${clip.id}`);

    const button = page.getByTestId("id-guide-button");
    await expect(button).toBeVisible({ timeout: 8_000 });
    await button.click();

    // Sheet is a dialog with the right aria-label
    const sheet = page.getByRole("dialog", { name: /Help me figure it out/i });
    await expect(sheet).toBeVisible();
    // Q1 prompt
    await expect(sheet.getByRole("heading", { name: /What kind of creature is this/i })).toBeVisible();
  });

  test("escape closes the sheet", async ({ page, request }) => {
    await signUpFresh(page);
    const clip = await findClipByStatus(request, "STAFF_LABELLED");
    await page.goto(`/feed/${clip.id}`);
    await page.getByTestId("id-guide-button").click();

    const sheet = page.getByRole("dialog", { name: /Help me figure it out/i });
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).not.toBeVisible({ timeout: 5_000 });
  });

  test("Skip-this-clip button at the bottom closes the sheet", async ({ page, request }) => {
    await signUpFresh(page);
    const clip = await findClipByStatus(request, "STAFF_LABELLED");
    await page.goto(`/feed/${clip.id}`);
    await page.getByTestId("id-guide-button").click();

    const sheet = page.getByRole("dialog", { name: /Help me figure it out/i });
    await expect(sheet).toBeVisible();

    await sheet.getByRole("button", { name: /Skip this clip/i }).click();
    await expect(sheet).not.toBeVisible({ timeout: 5_000 });
  });
});

test.describe("ID Guide — happy path (hermit crab in ≤4 taps)", () => {
  test("Crab → Crawling → Seabed → Hidden-in-shell ⇒ Hermit Crab", async ({ page, request }) => {
    await signUpFresh(page);
    const clip = await findClipByStatus(request, "STAFF_LABELLED");
    await page.goto(`/feed/${clip.id}`);
    await page.getByTestId("id-guide-button").click();

    const sheet = page.getByRole("dialog", { name: /Help me figure it out/i });
    await expect(sheet).toBeVisible();

    // Q1: Crab
    await sheet.getByRole("button", { name: /Crab \/ Lobster/i }).click();
    // Q2: Crawling on seabed
    await sheet.getByRole("button", { name: /Crawling on seabed/i }).click();
    // Q3: On the seabed
    await sheet.getByRole("button", { name: /On the seabed/i }).click();
    // Q4: Hidden in shell — last question for crab path is bodyShape
    await sheet.getByRole("button", { name: /Hidden in a shell/i }).click();
    // Q5: optional, just submit by skipping
    // (actually after Q4, Q5 colour is the last visible. Let's skip it.)
    await sheet.getByRole("button", { name: /Skip this question/i }).click();

    // Results should show Common Hermit Crab as a top match
    await expect(sheet.getByRole("heading", { name: /Common Hermit Crab/i })).toBeVisible({ timeout: 10_000 });

    // Confirm it
    await sheet.getByRole("button", { name: /Yes, that's it/i }).first().click();

    // Sheet closes and answer gets submitted via existing flow
    await expect(sheet).not.toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/(Spot on|Not this time|Help us ID)/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/You said:/i)).toBeVisible();
  });
});

test.describe("ID Guide — back / skip / type-instead", () => {
  test("back button drops the previous answer and lets you re-pick", async ({ page, request }) => {
    await signUpFresh(page);
    const clip = await findClipByStatus(request, "STAFF_LABELLED");
    await page.goto(`/feed/${clip.id}`);
    await page.getByTestId("id-guide-button").click();
    const sheet = page.getByRole("dialog", { name: /Help me figure it out/i });

    // Q1: pick fish
    await sheet.getByRole("button", { name: /^Fish$/ }).click();
    // Q2 should now be visible
    await expect(sheet.getByRole("heading", { name: /How does it move/i })).toBeVisible();
    // Tap back arrow (single ←)
    await sheet.getByRole("button", { name: "Back" }).click();
    // Q1 prompt back
    await expect(sheet.getByRole("heading", { name: /What kind of creature is this/i })).toBeVisible();
    // Pick crab this time
    await sheet.getByRole("button", { name: /Crab \/ Lobster/i }).click();
    // Q2 reachable again
    await expect(sheet.getByRole("heading", { name: /How does it move/i })).toBeVisible();
  });

  test("skip on optional question advances without recording", async ({ page, request }) => {
    await signUpFresh(page);
    const clip = await findClipByStatus(request, "STAFF_LABELLED");
    await page.goto(`/feed/${clip.id}`);
    await page.getByTestId("id-guide-button").click();
    const sheet = page.getByRole("dialog", { name: /Help me figure it out/i });

    await sheet.getByRole("button", { name: /^Fish$/ }).click();
    // Q2 (locomotion) is optional — Skip this question link should be visible
    await sheet.getByRole("button", { name: /Skip this question/i }).click();
    // Should land on Q3 (screenZone)
    await expect(sheet.getByRole("heading", { name: /Where is it in the frame/i })).toBeVisible();
  });

  test("Type instead closes the sheet and returns to input", async ({ page, request }) => {
    await signUpFresh(page);
    const clip = await findClipByStatus(request, "STAFF_LABELLED");
    await page.goto(`/feed/${clip.id}`);
    await page.getByTestId("id-guide-button").click();
    const sheet = page.getByRole("dialog", { name: /Help me figure it out/i });

    await sheet.getByRole("button", { name: /Type instead/i }).click();
    await expect(sheet).not.toBeVisible({ timeout: 5_000 });
    // Original input still focusable
    await expect(page.getByPlaceholder("Type species name")).toBeVisible();
  });
});
