// Phase 1 capture (authed follow-up) — sign back into the test account and grab
// the account/settings page + the public profile/pokedex.
import { chromium, type Page } from "playwright";

const BASE = "https://fish-spotter.vercel.app";
const OUT = "implementation/2026-06-14/ux-vision-review/shots";
const EMAIL = "fishspotter-uxreview-1781461877634@example.com";
const PASS = "UxReview2026";

async function dismissCookie(page: Page) {
  try { await page.locator('button:has-text("Got it")').first().click({ timeout: 3500 }); } catch {}
}
async function expand(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>(".overflow-y-auto,.overflow-auto").forEach((el) => { el.style.overflow = "visible"; el.style.height = "auto"; el.style.maxHeight = "none"; });
    document.body.style.height = "auto"; document.documentElement.style.height = "auto";
  });
}
async function dumpLinks(page: Page, label: string) {
  const links = await page.evaluate(() => Array.from(document.querySelectorAll("a[href]")).map((a) => (a as HTMLAnchorElement).getAttribute("href") || "").filter(Boolean));
  console.log(`[links @ ${label}] ${JSON.stringify([...new Set(links)])}`);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/auth/signin`, { waitUntil: "networkidle", timeout: 45000 });
    await dismissCookie(page);
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASS);
    await page.getByRole("button", { name: /^sign in$/i }).click({ timeout: 8000 });
    await page.waitForTimeout(3500);
    console.log(`after signin url: ${page.url()}`);

    // Account / settings
    await page.goto(`${BASE}/account`, { waitUntil: "networkidle", timeout: 45000 });
    await dismissCookie(page);
    await page.waitForTimeout(1500);
    await dumpLinks(page, "account");
    await expand(page);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/authed-06-account.png`, fullPage: true });
    console.log("SHOT authed-06-account");

    // Public profile / pokedex (from a /u/ link if present, else skip)
    const prof = page.locator('a[href^="/u/"]').first();
    if (await prof.count()) {
      const href = await prof.getAttribute("href");
      console.log(`profile href: ${href}`);
      await page.goto(`${BASE}${href}`, { waitUntil: "networkidle", timeout: 45000 });
      await dismissCookie(page);
      await page.waitForTimeout(1500);
      await expand(page);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/authed-07-profile-pokedex.png`, fullPage: true });
      console.log("SHOT authed-07-profile-pokedex");
    } else {
      console.log("no /u/ link on /account");
    }
  } catch (e) {
    console.log(`ERR ${(e as Error).message.slice(0, 160)}`);
  }
  await ctx.close();
  await browser.close();
  console.log("authed2 capture done");
})();
