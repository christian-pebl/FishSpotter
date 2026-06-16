// Live verification of Waves 1+2 reveal changes: a guest reveal (T-06/09/10) and
// an authed reveal (T-07 streak beat). Creates one disposable @example.com account.
import { chromium, type Page } from "playwright";

const BASE = "https://fish-spotter.vercel.app";
const OUT = "implementation/2026-06-14/ux-vision-review/shots";
const EMAIL = `fishspotter-w12-${Date.now()}@example.com`;
const PASS = "UxReview2026";

async function dismiss(p: Page) {
  try { await p.locator('button:has-text("Got it")').first().click({ timeout: 3000 }); } catch {}
}
async function freeze(p: Page) {
  await p.evaluate(() => document.querySelectorAll("video").forEach((v) => { try { (v as HTMLVideoElement).pause(); } catch {} }));
}
async function drive(p: Page) {
  await p.locator('button[aria-label="Identify this species"]').first().click({ timeout: 8000 });
  await p.waitForTimeout(800);
  await p.getByRole("button", { name: /^Fish, \d+ species/i }).click({ timeout: 6000 });
  await p.waitForTimeout(700);
  await p.getByRole("button", { name: /Torpedo or deep-bodied, \d+ species/i }).click({ timeout: 6000 });
  await p.waitForTimeout(700);
  await p.getByRole("button", { name: /^Pick Pollack/i }).first().click({ timeout: 5000 });
  await p.waitForTimeout(700);
  await p.getByRole("button", { name: /this is my pick/i }).first().click({ timeout: 5000 });
  await p.waitForTimeout(2600);
}

(async () => {
  const browser = await chromium.launch();

  // A. Guest reveal.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    try {
      await p.goto(`${BASE}/feed`, { waitUntil: "networkidle", timeout: 45000 });
      await dismiss(p);
      await p.waitForTimeout(2200);
      await drive(p);
      await freeze(p);
      await p.screenshot({ path: `${OUT}/w12-guest-reveal.png` });
      console.log("SHOT w12-guest-reveal");
    } catch (e) { console.log("guest err " + (e as Error).message.slice(0, 110)); }
    await ctx.close();
  }

  // B. Authed signup + reveal (streak beat).
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    try {
      await p.goto(`${BASE}/auth/signin?isSignUp=1`, { waitUntil: "networkidle", timeout: 45000 });
      await dismiss(p);
      await p.fill("#email", EMAIL);
      await p.fill("#name", "W12 Test");
      await p.fill("#password", PASS);
      await p.selectOption("#ageBracket", "18_plus").catch(() => {});
      await p.check('input[type="checkbox"]').catch(() => {});
      await p.getByRole("button", { name: /create account/i }).click({ timeout: 8000 });
      await p.waitForTimeout(4000);
      if (!/\/feed/.test(p.url())) await p.goto(`${BASE}/feed`, { waitUntil: "networkidle", timeout: 45000 });
      await dismiss(p);
      // step through + close the onboarding tour
      for (let i = 0; i < 3; i++) {
        const n = p.getByRole("button", { name: /^next$/i });
        if (await n.count()) { await n.first().click().catch(() => {}); await p.waitForTimeout(400); }
      }
      await p.getByRole("button", { name: /got it|skip/i }).first().click({ timeout: 3000 }).catch(() => {});
      await p.waitForTimeout(1200);
      await drive(p);
      await freeze(p);
      await p.screenshot({ path: `${OUT}/w12-authed-reveal.png` });
      console.log("SHOT w12-authed-reveal");
    } catch (e) { console.log("authed err " + (e as Error).message.slice(0, 110)); }
    await ctx.close();
  }

  await browser.close();
  console.log(`done. email=${EMAIL}`);
})();
