// Phase 1 capture — signed-in states. Creates ONE throwaway test account
// (@example.com, which silently discards mail) and captures the new-user authed
// journey: onboarding tour, authed feed, authed reveal (points/streak), and the
// profile / pokedex. Writes ~1 user + ~1 answer row to the shared prod DB.
import { chromium, type Page } from "playwright";

const BASE = "https://fish-spotter.vercel.app";
const OUT = "implementation/2026-06-14/ux-vision-review/shots";
const EMAIL = `fishspotter-uxreview-${Date.now()}@example.com`;
const PASS = "UxReview2026";

async function dismissCookie(page: Page) {
  try { await page.locator('button:has-text("Got it")').first().click({ timeout: 3500 }); } catch {}
}
async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`SHOT ${name}`);
}
async function dumpLinks(page: Page, label: string) {
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a[href]")).map((a) => (a as HTMLAnchorElement).getAttribute("href") || "").filter(Boolean));
  console.log(`[links @ ${label}] ${JSON.stringify([...new Set(links)])}`);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  try {
    // ---- Sign up ----
    await page.goto(`${BASE}/auth/signin?isSignUp=1`, { waitUntil: "networkidle", timeout: 45000 });
    await dismissCookie(page);
    await page.fill("#email", EMAIL);
    await page.fill("#name", "UX Review");
    await page.fill("#password", PASS);
    await page.selectOption("#ageBracket", "18_plus").catch(() => {});
    await page.check('input[type="checkbox"]').catch(() => {});
    await shot(page, "authed-00-signup-filled");
    await page.getByRole("button", { name: /create account/i }).click({ timeout: 8000 });
    await page.waitForTimeout(4000);
    console.log(`after signup url: ${page.url()}`);

    // ---- Onboarding tour (first signed-in feed visit) ----
    if (!/\/feed/.test(page.url())) {
      await page.goto(`${BASE}/feed`, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(2500);
    }
    await dismissCookie(page);
    await page.waitForTimeout(1500);
    await shot(page, "authed-01-onboarding-or-feed");
    // Step through the tour if present.
    for (let i = 0; i < 3; i++) {
      const next = page.getByRole("button", { name: /^next$/i });
      if (await next.count()) { await next.first().click().catch(() => {}); await page.waitForTimeout(700); await shot(page, `authed-01b-tour-step${i + 2}`); }
    }
    // Close the tour.
    await page.getByRole("button", { name: /got it|skip/i }).first().click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await shot(page, "authed-02-feed-authed");

    // ---- Authed reveal (writes 1 answer row) ----
    try {
      await page.locator('button[aria-label="Identify this species"]').first().click({ timeout: 8000 });
      await page.waitForTimeout(900);
      await page.getByRole("button", { name: /^Fish, 28 species/i }).click({ timeout: 6000 });
      await page.waitForTimeout(800);
      await page.getByRole("button", { name: /Torpedo or deep-bodied, \d+ species/i }).click({ timeout: 6000 });
      await page.waitForTimeout(900);
      await page.getByRole("button", { name: /^Pick Saithe/i }).first().click({ timeout: 5000 });
      await page.waitForTimeout(900);
      await page.getByRole("button", { name: /this is my pick/i }).first().click({ timeout: 5000 });
      await page.waitForTimeout(2500); // let confetti/points settle
      await shot(page, "authed-03-reveal-authed");
    } catch (e) { console.log(`authed-reveal err ${(e as Error).message.slice(0, 80)}`); }

    // ---- Find + capture profile / pokedex via the header menu ----
    await page.locator('button[aria-label="Open menu"]').first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);
    await dumpLinks(page, "menu");
    await shot(page, "authed-04-menu");
    const profile = page.locator('a[href^="/u/"]').first();
    if (await profile.count()) {
      const href = await profile.getAttribute("href");
      console.log(`profile href: ${href}`);
      await page.goto(`${BASE}${href}`, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(1800);
      await page.evaluate(() => {
        document.querySelectorAll<HTMLElement>(".overflow-y-auto,.overflow-auto").forEach((el) => { el.style.overflow = "visible"; el.style.height = "auto"; el.style.maxHeight = "none"; });
        document.body.style.height = "auto"; document.documentElement.style.height = "auto";
      });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/authed-05-pokedex-profile.png`, fullPage: true });
      console.log("SHOT authed-05-pokedex-profile");
    } else {
      console.log("no /u/ profile link found in menu");
    }
  } catch (e) {
    console.log(`AUTHED ERR ${(e as Error).message.slice(0, 160)}`);
  }
  await ctx.close();
  await browser.close();
  console.log(`authed capture done (test account: ${EMAIL})`);
})();
