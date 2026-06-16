// Verify two caveated findings: (1) is the landing demo card genuinely empty, or
// did the first capture catch a pre-load frame? (2) capture the REAL signed-in
// reveal (the first attempt caught feed-idle).
import { chromium, type Page } from "playwright";

const BASE = "https://fish-spotter.vercel.app";
const OUT = "implementation/2026-06-14/ux-vision-review/shots";
const EMAIL = "fishspotter-uxreview-1781461877634@example.com";
const PASS = "UxReview2026";

async function dismissCookie(page: Page) {
  try { await page.locator('button:has-text("Got it")').first().click({ timeout: 3500 }); } catch {}
}
async function dump(page: Page, label: string) {
  const t = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 240));
  console.log(`[text @ ${label}] ${t}`);
}

(async () => {
  const browser = await chromium.launch();

  // (1) Landing demo card — wait long for the hero video to load + play.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 45000 });
      await dismissCookie(page);
      await page.waitForTimeout(7000); // let the hero clip buffer + loop to a fish frame
      const vid = await page.evaluate(() => {
        const v = document.querySelector("video");
        return v ? { readyState: v.readyState, paused: v.paused, ct: v.currentTime, src: (v.currentSrc || "").slice(0, 60) } : null;
      });
      console.log(`demo video state: ${JSON.stringify(vid)}`);
      await page.screenshot({ path: `${OUT}/verify-demo-card.png` });
      console.log("SHOT verify-demo-card");
    } catch (e) { console.log(`DEMO ERR ${(e as Error).message.slice(0, 100)}`); }
    await ctx.close();
  }

  // (2) Real signed-in reveal.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE}/auth/signin`, { waitUntil: "networkidle", timeout: 45000 });
      await dismissCookie(page);
      await page.fill("#email", EMAIL);
      await page.fill("#password", PASS);
      await page.getByRole("button", { name: /^sign in$/i }).click({ timeout: 8000 });
      await page.waitForTimeout(3500);
      await page.goto(`${BASE}/feed`, { waitUntil: "networkidle", timeout: 45000 });
      await dismissCookie(page);
      await page.waitForTimeout(2500);
      // Enter the identify flow. Try the catcher, else an explicit Identify button.
      await page.locator('button[aria-label="Identify this species"]').first().click({ timeout: 6000 }).catch(async () => {
        await page.getByRole("button", { name: /^identify$/i }).first().click({ timeout: 6000 }).catch(() => {});
      });
      await page.waitForTimeout(1000);
      await page.getByRole("button", { name: /^Fish, \d+ species/i }).click({ timeout: 6000 });
      await page.waitForTimeout(800);
      await page.getByRole("button", { name: /Torpedo or deep-bodied, \d+ species/i }).click({ timeout: 6000 });
      await page.waitForTimeout(900);
      await page.getByRole("button", { name: /^Pick Saithe/i }).first().click({ timeout: 5000 });
      await page.waitForTimeout(900);
      await page.getByRole("button", { name: /this is my pick/i }).first().click({ timeout: 5000 });
      await page.waitForTimeout(3000);
      await dump(page, "authed-reveal");
      await page.screenshot({ path: `${OUT}/verify-authed-reveal.png` });
      console.log("SHOT verify-authed-reveal");
    } catch (e) { console.log(`AUTHED-REVEAL ERR ${(e as Error).message.slice(0, 120)}`); }
    await ctx.close();
  }

  await browser.close();
  console.log("verify recapture done");
})();
