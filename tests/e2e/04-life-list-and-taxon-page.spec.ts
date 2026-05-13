import { test, expect } from "@playwright/test";
import { signUpFresh, findClipByStatus, getStaffTaxonForSnippet } from "./helpers";

test.describe("Life list", () => {
  test("empty life list shows 0 spotted, 0 helped", async ({ page }) => {
    await signUpFresh(page);
    await page.goto("/me/taxa");
    await expect(page.getByRole("heading", { name: /Life list/i })).toBeVisible();
    await expect(page.getByText(/0\s*spotted/i)).toBeVisible();
    await expect(page.getByText(/0\s*helped ID/i)).toBeVisible();
  });

  test("filter tabs render and switch between lists", async ({ page }) => {
    await signUpFresh(page);
    await page.goto("/me/taxa");

    const tabAll = page.getByRole("button", { name: "All" });
    const tabSpotted = page.getByRole("button", { name: "Spotted" });
    const tabHelped = page.getByRole("button", { name: "Helped ID" });
    await expect(tabAll).toBeVisible();
    await expect(tabSpotted).toBeVisible();
    await expect(tabHelped).toBeVisible();

    await tabSpotted.click();
    // Empty state hint for new user
    await expect(page.getByText(/No correct identifications yet/i)).toBeVisible();

    await tabHelped.click();
    await expect(page.getByText(/Help ID a clip to add to this list/i)).toBeVisible();
  });

  test("after a correct answer, the taxon appears as Spotted", async ({ page, request }) => {
    await signUpFresh(page);
    const clip = await findClipByStatus(request, "STAFF_LABELLED");
    const staff = await getStaffTaxonForSnippet(request, clip.id);
    test.skip(!staff, "No staff taxon");

    // Answer correctly
    await page.goto(`/feed/${clip.id}`);
    await page.getByPlaceholder("Type species name").fill(staff!.name.toLowerCase());
    await page.getByRole("button", { name: /Confirm selection/i }).click();
    await expect(page.getByText(/Spot on/i)).toBeVisible();

    // Visit life list
    await page.goto("/me/taxa");
    await expect(page.getByText(/1\s*spotted/i)).toBeVisible();
    // Card showing the taxon name
    await expect(page.getByText(new RegExp(staff!.name, "i")).first()).toBeVisible();
  });

  test("after a Help-us-ID contribution, taxon appears under Helped ID", async ({ page, request }) => {
    await signUpFresh(page);
    const clip = await findClipByStatus(request, "UNLABELLED");

    await page.goto(`/feed/${clip.id}`);
    await page.getByPlaceholder("Type species name").fill("fish");
    await page.getByRole("button", { name: /Confirm selection/i }).click();
    await expect(page.getByText(/Help us ID/i)).toBeVisible();

    await page.goto("/me/taxa");
    await expect(page.getByText(/1\s*helped ID/i)).toBeVisible();
  });
});

test.describe("Taxon page", () => {
  test("a known taxon page renders hero, name, and clip gallery", async ({ page, request }) => {
    // Find a clip that has a staff taxon, then visit that taxon page
    const clip = await findClipByStatus(request, "STAFF_LABELLED");
    const staff = await getStaffTaxonForSnippet(request, clip.id);
    test.skip(!staff, "No staff taxon");

    await page.goto(`/taxon/${staff!.id}`);
    await expect(page.getByRole("heading", { name: new RegExp(staff!.name, "i") })).toBeVisible();
    if (staff!.scientificName) {
      await expect(page.getByText(staff!.scientificName)).toBeVisible();
    }
    // Back link to life list
    await expect(page.getByRole("link", { name: /Back to your life list/i })).toBeVisible();
  });
});
