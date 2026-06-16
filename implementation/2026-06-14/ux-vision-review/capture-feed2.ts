// Phase 1 capture (refinement) — drive the rungs by explicit label to reach the
// candidate tiles, the species flash-card (Rung-3 teaching popup), and the feed
// reveal with the guest "save your finds" nudge. Best-effort map modal.
import { chromium, type Page } from "playwright";

const BASE = "https://fish-spotter.vercel.app";
const OUT = "implementation/2026-06-14/ux-vision-review/shots";

async function dismissCookie(page: Page) {
  try { await page.locator('button:has-text("Got it")').first().click({ timeout: 3500 }); } catch {}
}
async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`SHOT ${name}`);
}
async function dump(page: Page, label: string) {
  const btns = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .map((b) => (b.getAttribute("aria-label") || b.textContent || "").replace(/\s+/g, " ").trim().slice(0, 44))
      .filter(Boolean));
  console.log(`[@${label}] ${JSON.stringify([...new Set(btns)])}`);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/feed`, { waitUntil: "networkidle", timeout: 45000 });
    await dismissCookie(page);
    await page.waitForTimeout(2200);

    // tap -> shape gate -> Fish -> Torpedo (rung 3 candidates)
    await page.locator('button[aria-label="Identify this species"]').first().click({ timeout: 8000 });
    await page.waitForTimeout(900);
    await page.getByRole("button", { name: /^Fish, 28 species/i }).click({ timeout: 6000 });
    await page.waitForTimeout(900);
    await page.getByRole("button", { name: /Torpedo or deep-bodied, \d+ species/i }).click({ timeout: 6000 });
    await page.waitForTimeout(1300);
    await dump(page, "rung3-candidates");
    await shot(page, "feed-04-rung3-candidates");

    // Click an explicit "Pick <species>" tile -> species flash-card popup.
    await page.getByRole("button", { name: /^Pick Pollack/i }).first().click({ timeout: 5000 });
    console.log("clicked Pick Pollack");
    await page.waitForTimeout(1300);
    await dump(page, "after-candidate-click");
    await shot(page, "feed-04b-species-flashcard");

    // Commit via "This is my pick" (or any commit affordance) -> reveal.
    const commit = page.getByRole("button", { name: /this is my pick|that.?s it|confirm|i.?m sure/i });
    if (await commit.count()) {
      await commit.first().click({ timeout: 5000 }).catch(() => {});
    }
    await page.waitForTimeout(2000);
    await dump(page, "reveal");
    await shot(page, "feed-05-reveal");

    // Best-effort: open the map from the reveal's "Where is this?" action.
    const map = page.getByRole("button", { name: /where is this|where this clip was recorded/i });
    if (await map.count()) {
      await map.first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1500);
      await shot(page, "feed-07-map-modal");
    } else {
      console.log("map button not present on reveal");
    }
  } catch (e) {
    console.log(`ERR ${(e as Error).message.slice(0, 160)}`);
  }
  await ctx.close();
  await browser.close();
  console.log("feed2 capture done");
})();
