import { test, expect } from "@playwright/test";
import { signUpFresh, findClipByStatus, getStaffTaxonForSnippet } from "./helpers";

test.describe("Answer flow — Verified clips", () => {
  test("correct answer shows green verdict + 10 pts + Spot on", async ({ page, request }) => {
    await signUpFresh(page);
    const clip = await findClipByStatus(request, "STAFF_LABELLED");
    const staff = await getStaffTaxonForSnippet(request, clip.id);
    test.skip(!staff, "Couldn't find staff taxon for first verified clip");

    const correctName = staff!.name.toLowerCase();

    await page.goto(`/feed/${clip.id}`);
    await page.getByPlaceholder("Type species name").fill(correctName);
    await page.getByRole("button", { name: /Confirm selection/i }).click();

    await expect(page.getByText(/Spot on/i)).toBeVisible();
    await expect(page.getByText(/\+10\s*pts/i)).toBeVisible();
    await expect(page.getByText(/You said:/i)).toBeVisible();
    await expect(page.getByText(/change/i)).toBeVisible();
  });

  test("wrong answer shows orange verdict + 1 pt + reveal of true taxon", async ({ page, request }) => {
    await signUpFresh(page);
    const clip = await findClipByStatus(request, "STAFF_LABELLED");
    const staff = await getStaffTaxonForSnippet(request, clip.id);
    test.skip(!staff, "Couldn't find staff taxon");

    // Pick a deliberately-wrong taxon: choose by functional group for guaranteed mismatch
    const isCrab = staff!.name.toLowerCase().includes("crab") || staff!.name.toLowerCase().includes("hermit");
    const isJelly = staff!.name.toLowerCase().includes("jelly") || staff!.name.toLowerCase().includes("gooseberry");
    let wrongName = "moon jellyfish"; // not a crab and not a typical fish
    if (isJelly) wrongName = "common hermit crab";
    else if (isCrab) wrongName = "moon jellyfish";
    // never accidentally pick the same taxon
    if (wrongName.toLowerCase() === staff!.name.toLowerCase()) wrongName = "common starfish";

    await page.goto(`/feed/${clip.id}`);
    await page.getByPlaceholder("Type species name").fill(wrongName);
    await page.getByRole("button", { name: /Confirm selection/i }).click();

    // If a correction prompt appears, dismiss with "Use my answer"
    const useMine = page.getByRole("button", { name: /Use my answer/i });
    if (await useMine.isVisible({ timeout: 1500 }).catch(() => false)) {
      await useMine.click();
    }

    await expect(page.getByText(/Not this time/i)).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/\+1\s*pts/i)).toBeVisible();
    // Reveal panel still shows the actual taxon name — use heading specifically (single match)
    await expect(
      page.getByRole("heading", { name: new RegExp(`^${staff!.name}$`, "i") }),
    ).toBeVisible();
  });

  test("change-answer flow works: wrong → edit → correct (points update)", async ({ page, request }) => {
    await signUpFresh(page);
    const clip = await findClipByStatus(request, "STAFF_LABELLED");
    const staff = await getStaffTaxonForSnippet(request, clip.id);
    test.skip(!staff, "Couldn't find staff taxon");

    await page.goto(`/feed/${clip.id}`);

    // First: a wrong answer with skipCorrection (use 'spider crab' as it likely won't fuzzy-match anything else)
    await page.getByPlaceholder("Type species name").fill("zarboon");
    await page.getByRole("button", { name: /Confirm selection/i }).click();
    const useMine = page.getByRole("button", { name: /Use my answer/i });
    if (await useMine.isVisible({ timeout: 1500 }).catch(() => false)) {
      await useMine.click();
    }

    await expect(page.getByText(/Not this time/i)).toBeVisible();

    // Now click "change"
    await page.getByRole("button", { name: /change/i }).click();

    // Resubmit with the correct answer
    await page.getByPlaceholder("Type species name").fill(staff!.name.toLowerCase());
    await page.getByRole("button", { name: /Confirm selection/i }).click();

    await expect(page.getByText(/Spot on/i)).toBeVisible();
    await expect(page.getByText(/\+10\s*pts/i)).toBeVisible();
  });
});

test.describe("Answer flow — Help-us-ID", () => {
  test("any answer on unlabelled clip earns 5 contribution pts", async ({ page, request }) => {
    await signUpFresh(page);
    const clip = await findClipByStatus(request, "UNLABELLED");

    await page.goto(`/feed/${clip.id}`);
    await page.getByPlaceholder("Type species name").fill("fish");
    await page.getByRole("button", { name: /Confirm selection/i }).click();

    await expect(page.getByText(/Help us ID/i)).toBeVisible();
    await expect(page.getByText(/\+5\s*pts/i)).toBeVisible();
    await expect(page.getByText(/Thank you for contributing/i)).toBeVisible();
  });
});
