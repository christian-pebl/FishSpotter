import { expect, test, type Page } from "@playwright/test";

/**
 * The video archive's filter row, end to end, against the real archive.
 *
 * Regression for 3 Sep 2026: choosing a location "only re-sorted", the count
 * still said the whole archive, and "Launch feed of current filtered videos"
 * opened the unfiltered feed. The cause was the parser, not the query: the
 * filter row is a GET form, a form submits every control, and the blank
 * `species=` it sent alongside a real `site=` failed the whole filter.
 *
 * These tests read whatever the archive holds rather than assuming a site, so
 * they hold on any database with at least one clip.
 */

const COUNT_IN_LABEL = /\((\d+)\)\s*$/;

// Each test walks two server-rendered routes, and on a cold dev server the
// first compile of /feed alone can take most of the default 30s.
test.describe.configure({ timeout: 90_000 });

type Choice = { value: string; clips: number };

/** Open the archive and wait until its filter row is on screen. */
async function openArchive(page: Page, url = "/feed/browse") {
  // The grid's thumbnails come from object storage and are not what these
  // tests are about, so do not wait for them: the markup is server-rendered.
  await page.goto(url, { waitUntil: "domcontentloaded" });
  // The route streams its loading skeleton first and the grid only once the
  // database has answered, so DOMContentLoaded is not "the page is here".
  await expect(page.getByLabel("Filter by location")).toBeVisible({ timeout: 60_000 });
  // And the markup arriving is not React being in charge of it yet: a change
  // made before hydration goes nowhere. The filter row marks itself once it is.
  await expect(page.locator("form[aria-label='Filter clips'][data-hydrated]")).toBeAttached({
    timeout: 60_000,
  });
}

/** The first real option of a dropdown, with the clip count its label carries. */
async function firstChoice(page: Page, label: string): Promise<Choice | null> {
  const select = page.getByLabel(label);
  await expect(select).toBeVisible();
  const options = await select
    .locator("option")
    .evaluateAll((els) =>
      els.map((o) => ({ value: (o as HTMLOptionElement).value, label: o.textContent ?? "" })),
    );
  const first = options.find((o) => o.value);
  if (!first) return null;
  return { value: first.value, clips: Number(COUNT_IN_LABEL.exec(first.label)?.[1]) };
}

test.describe("Video archive: filter by location", () => {
  test("choosing a location narrows the grid to that site and says how many matched", async ({ page }) => {
    await openArchive(page);
    const location = await firstChoice(page, "Filter by location");
    test.skip(!location, "the archive holds no clips");
    const { value: site, clips } = location as Choice;
    expect(Number.isFinite(clips), "the option label carries a count").toBe(true);

    // Changing the dropdown applies it: no Apply button to find.
    await page.getByLabel("Filter by location").selectOption(site);
    await page.waitForURL((url) => url.searchParams.get("site") === site);

    // The URL is the canonical one: nothing blank, no default sort.
    expect(page.url()).not.toMatch(/[?&](species|sort|q|page)=/);

    // The count states the narrowing, the control shows the choice.
    await expect(page.getByTestId("archive-count")).toHaveText(
      new RegExp(`^${clips} of \\d+ clips match$`),
    );
    await expect(page.getByLabel("Filter by location")).toHaveValue(site);

    // Every card on the page is from that site, and there are as many as promised.
    const cards = page.locator("main ul > li");
    await expect(cards).toHaveCount(Math.min(clips, 24));
    const names = await cards.locator("p.font-semibold").allTextContents();
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(name).toBe(site);
  });

  test("the launched feed holds exactly the filtered clips", async ({ page }) => {
    await openArchive(page);
    const location = await firstChoice(page, "Filter by location");
    test.skip(!location, "the archive holds no clips");
    const { value: site, clips } = location as Choice;

    await openArchive(page, `/feed/browse?site=${encodeURIComponent(site)}`);
    const launch = page.getByRole("link", { name: /launch feed of current filtered videos/i });
    const href = new URL((await launch.getAttribute("href")) as string, page.url());
    expect(href.pathname).toBe("/feed");
    expect(href.searchParams.get("site")).toBe(site);

    await launch.click();
    await page.waitForURL((url) => url.pathname === "/feed" && url.searchParams.get("site") === site, {
      waitUntil: "domcontentloaded",
    });

    // The feed says which selection it is showing and how big it is, and links
    // back to the same selection in the archive.
    const notice = page.getByRole("status").filter({ hasText: site });
    await expect(notice).toContainText(`${clips} clip`);
    const back = notice.getByRole("link", { name: site });
    const backHref = new URL((await back.getAttribute("href")) as string, page.url());
    expect(backHref.pathname).toBe("/feed/browse");
    expect(backHref.searchParams.get("site")).toBe(site);
  });

  test("the exact URL a no-JavaScript form submit produces still filters", async ({ page }) => {
    await openArchive(page);
    const location = await firstChoice(page, "Filter by location");
    test.skip(!location, "the archive holds no clips");
    const { value: site, clips } = location as Choice;

    // Every control present, blanks included: what the form sends for
    // "this location, all species, default sort".
    await openArchive(page, `/feed/browse?species=&site=${encodeURIComponent(site)}&sort=newest`);
    await expect(page.getByTestId("archive-count")).toHaveText(new RegExp(`^${clips} of \\d+ clips match$`));
    await expect(page.getByLabel("Filter by location")).toHaveValue(site);

    const launch = page.getByRole("link", { name: /launch feed of current filtered videos/i });
    const href = new URL((await launch.getAttribute("href")) as string, page.url());
    expect(href.searchParams.get("site")).toBe(site);
    expect(href.searchParams.has("species")).toBe(false);
  });
});

test.describe("Video archive: share a selection", () => {
  test("a species selection copies as a link that reopens the same selection", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    // Force the clipboard route on both projects: the mobile one would open a
    // native share sheet, which a test cannot read back.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    });

    await openArchive(page);
    const species = await firstChoice(page, "Filter by species");
    test.skip(!species, "the community has not settled a species yet");
    const { value: slug, clips } = species as Choice;

    await page.getByLabel("Filter by species").selectOption(slug);
    await page.waitForURL((url) => url.searchParams.get("species") === slug);
    await expect(page.getByText(/identified as .* by|community has identified as/)).toBeVisible();

    await page.getByRole("button", { name: /share this selection/i }).click();
    await expect(page.getByRole("status").filter({ hasText: "Link copied" })).toBeVisible();

    const copied = await page.evaluate(() => navigator.clipboard.readText());
    const url = new URL(copied);
    expect(url.origin).toBe(new URL(page.url()).origin);
    expect(url.pathname).toBe("/feed/browse");
    expect([...url.searchParams.entries()]).toEqual([["species", slug]]);

    // Someone opening the link lands on the same selection.
    await openArchive(page, copied);
    await expect(page.getByLabel("Filter by species")).toHaveValue(slug);
    await expect(page.getByTestId("archive-count")).toHaveText(new RegExp(`^${clips} of \\d+ clips match$`));
  });
});
