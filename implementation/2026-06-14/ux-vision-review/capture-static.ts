// Phase 1 capture — static/content pages of the LIVE app, full-page, mobile +
// desktop. Robust per-shot try/catch so one failure never aborts the run.
import { chromium, type Page } from "playwright";

const BASE = "https://fish-spotter.vercel.app";
const OUT = "implementation/2026-06-14/ux-vision-review/shots";

async function dismissCookie(page: Page) {
  try {
    await page.locator('button:has-text("Got it")').first().click({ timeout: 3500 });
  } catch {}
}

// The app scrolls inside an inner overflow container, not the document, so plain
// fullPage clips. Expand those containers so fullPage captures everything.
async function expandScrollers(page: Page) {
  await page.evaluate(() => {
    document
      .querySelectorAll<HTMLElement>(".overflow-y-auto,.overflow-auto,.overflow-y-scroll")
      .forEach((el) => {
        el.style.overflow = "visible";
        el.style.height = "auto";
        el.style.maxHeight = "none";
      });
    document.documentElement.style.height = "auto";
    document.body.style.height = "auto";
  });
}

async function capPage(page: Page, route: string, name: string, prefix: string) {
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 45000 });
    await dismissCookie(page);
    await page.waitForTimeout(1200);
    await expandScrollers(page);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${prefix}-${name}.png`, fullPage: true });
    console.log(`OK   ${prefix}-${name}  (${route})`);
  } catch (e) {
    console.log(`FAIL ${prefix}-${name}  (${route})  ${(e as Error).message.slice(0, 80)}`);
  }
}

const ROUTES: Array<[string, string]> = [
  ["/", "landing"],
  ["/feed/browse", "browse"],
  ["/leaderboard", "leaderboard"],
  ["/auth/signin", "signin"],
  ["/auth/signin?isSignUp=1", "signup"],
  ["/auth/forgot", "forgot-password"],
  ["/species/callionymus-lyra", "species-dragonet"],
  ["/species/cancer-pagurus", "species-crab"],
  ["/species/asterias-rubens", "species-starfish"],
  ["/privacy", "privacy"],
  ["/terms", "terms"],
  ["/accessibility", "accessibility"],
  ["/this-route-does-not-exist-xyz", "notfound"],
];

// Desktop only for the surfaces whose layout meaningfully differs at width.
const DESKTOP_ROUTES: Array<[string, string]> = [
  ["/", "landing"],
  ["/feed/browse", "browse"],
  ["/leaderboard", "leaderboard"],
  ["/auth/signin", "signin"],
  ["/species/callionymus-lyra", "species-dragonet"],
];

(async () => {
  const browser = await chromium.launch();

  // Mobile
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const mpage = await mctx.newPage();
  for (const [route, name] of ROUTES) await capPage(mpage, route, name, "m");
  await mctx.close();

  // Desktop
  const dctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const dpage = await dctx.newPage();
  for (const [route, name] of DESKTOP_ROUTES) await capPage(dpage, route, name, "d");
  await dctx.close();

  await browser.close();
  console.log("static capture done");
})();
