import { chromium } from "playwright";

const BASE = "https://fish-spotter.vercel.app";
const OUT = "implementation/2026-06-14/ux-vision-review/shots";
const ID = "cmqe4eo6s0000i904vhfjpg3l"; // test user (representative empty pokedex)

(async () => {
  const browser = await chromium.launch();
  for (const v of [
    { w: 390, h: 844, pre: "m" },
    { w: 1280, h: 800, pre: "d" },
  ]) {
    const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h } });
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE}/u/${ID}`, { waitUntil: "networkidle", timeout: 45000 });
      try { await page.locator('button:has-text("Got it")').first().click({ timeout: 3000 }); } catch {}
      await page.waitForTimeout(1500);
      await page.evaluate(() => {
        document.querySelectorAll<HTMLElement>(".overflow-y-auto,.overflow-auto").forEach((el) => { el.style.overflow = "visible"; el.style.height = "auto"; el.style.maxHeight = "none"; });
        document.body.style.height = "auto"; document.documentElement.style.height = "auto";
      });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/${v.pre}-profile-pokedex.png`, fullPage: true });
      console.log(`SHOT ${v.pre}-profile-pokedex`);
    } catch (e) { console.log(`ERR ${v.pre} ${(e as Error).message.slice(0, 80)}`); }
    await ctx.close();
  }
  await browser.close();
  console.log("profile capture done");
})();
