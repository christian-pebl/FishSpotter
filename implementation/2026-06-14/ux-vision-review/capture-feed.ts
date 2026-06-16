// Phase 1 capture — the guest core loop (the heart of the app). Drives the feed
// identify flow and screenshots every reachable state. Logs the control
// inventory at each gate so selectors can be verified. Per-step try/catch.
import { chromium, type Page, type BrowserContext } from "playwright";

const BASE = "https://fish-spotter.vercel.app";
const OUT = "implementation/2026-06-14/ux-vision-review/shots";
const CRAB = "cmosj7b1800067i80ma7572ws"; // snippet whose staffAnswer is "Crab"

async function dismissCookie(page: Page) {
  try {
    await page.locator('button:has-text("Got it")').first().click({ timeout: 3500 });
  } catch {}
}
async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`SHOT ${name}`);
}
async function dump(page: Page, label: string) {
  const btns = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .map((b) => (b.getAttribute("aria-label") || b.textContent || "").replace(/\s+/g, " ").trim().slice(0, 44))
      .filter(Boolean),
  );
  console.log(`[buttons @ ${label}] ${JSON.stringify([...new Set(btns)])}`);
}
async function freezeVideos(page: Page) {
  await page.evaluate(() =>
    document.querySelectorAll("video").forEach((v) => {
      try { (v as HTMLVideoElement).pause(); } catch {}
    }),
  );
}

async function newMobile(browser: Awaited<ReturnType<typeof chromium.launch>>): Promise<[BrowserContext, Page]> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  return [ctx, page];
}

(async () => {
  const browser = await chromium.launch();

  // ---- A. Feed idle + the full rung flow on the active card ----
  {
    const [ctx, page] = await newMobile(browser);
    try {
      await page.goto(`${BASE}/feed`, { waitUntil: "networkidle", timeout: 45000 });
      await dismissCookie(page);
      await page.waitForTimeout(2500); // let the tap-hint + first loop settle
      await shot(page, "feed-01-idle");

      // Open the identify flow via the full-card catcher (video playing).
      await page.locator('button[aria-label="Identify this species"]').first().click({ timeout: 8000 });
      await page.waitForTimeout(1200);
      await dump(page, "rung1-shapegate");
      await shot(page, "feed-02-rung1-shapegate");

      // Rung 1 -> pick "Fish" (has a sub-split, so it should reveal rung 2).
      await page.getByRole("button", { name: /fish/i }).first().click({ timeout: 6000 });
      await page.waitForTimeout(1000);
      await dump(page, "rung2-or-candidates");
      await shot(page, "feed-03-rung2-bodyshape");

      // Advance one more rung (pick the first tile of whatever is shown).
      const tiles = page.locator('[role="dialog"] button, .pointer-events-auto button');
      const n = await tiles.count();
      console.log(`rung tiles visible: ${n}`);
      // Click a middle tile to avoid Back/Hide/Close which tend to be first/last.
      for (let i = 0; i < n; i++) {
        const label = ((await tiles.nth(i).getAttribute("aria-label")) || (await tiles.nth(i).innerText()) || "").toLowerCase();
        if (!/hide|back|close|minimi|not sure|skip|drag/.test(label)) {
          await tiles.nth(i).click({ timeout: 4000 }).catch(() => {});
          break;
        }
      }
      await page.waitForTimeout(1200);
      await dump(page, "rung3-candidates");
      await shot(page, "feed-04-rung3-candidates");

      // Commit a candidate -> guest reveal. Pick the first species-looking tile.
      const ctiles = page.locator('.pointer-events-auto button, [role="dialog"] button');
      const cn = await ctiles.count();
      for (let i = 0; i < cn; i++) {
        const label = ((await ctiles.nth(i).getAttribute("aria-label")) || (await ctiles.nth(i).innerText()) || "").toLowerCase();
        if (!/hide|back|close|minimi|not sure|skip|drag|pick from|where is/.test(label) && label.length > 1) {
          await ctiles.nth(i).click({ timeout: 4000 }).catch(() => {});
          break;
        }
      }
      await page.waitForTimeout(1800);
      await dump(page, "reveal");
      await shot(page, "feed-05-reveal");
    } catch (e) {
      console.log(`FEED-FLOW ERR ${(e as Error).message.slice(0, 120)}`);
    }
    await ctx.close();
  }

  // ---- B. Minimized state (tap -> shape gate -> minimise to corner bubble) ----
  {
    const [ctx, page] = await newMobile(browser);
    try {
      await page.goto(`${BASE}/feed`, { waitUntil: "networkidle", timeout: 45000 });
      await dismissCookie(page);
      await page.waitForTimeout(1500);
      await page.locator('button[aria-label="Identify this species"]').first().click({ timeout: 8000 });
      await page.locator('button[aria-label="Minimise to a bubble and watch the clip"]').first().click({ timeout: 8000 });
      await page.waitForTimeout(900);
      await freezeVideos(page);
      await page.waitForTimeout(300);
      await shot(page, "feed-06-minimized");
    } catch (e) {
      console.log(`MINIMIZE ERR ${(e as Error).message.slice(0, 120)}`);
    }
    await ctx.close();
  }

  // ---- C. Map modal ("Where is this?") ----
  {
    const [ctx, page] = await newMobile(browser);
    try {
      await page.goto(`${BASE}/feed`, { waitUntil: "networkidle", timeout: 45000 });
      await dismissCookie(page);
      await page.waitForTimeout(1500);
      await page.getByRole("button", { name: /where is this/i }).first().click({ timeout: 8000 });
      await page.waitForTimeout(1500);
      await shot(page, "feed-07-map-modal");
    } catch (e) {
      console.log(`MAP ERR ${(e as Error).message.slice(0, 120)}`);
    }
    await ctx.close();
  }

  // ---- D. Single-snippet page: challenge + a KNOWN-correct reveal (type "Crab") ----
  {
    const [ctx, page] = await newMobile(browser);
    try {
      await page.goto(`${BASE}/feed/${CRAB}`, { waitUntil: "networkidle", timeout: 45000 });
      await dismissCookie(page);
      await page.waitForTimeout(1500);
      await freezeVideos(page);
      await shot(page, "snippet-01-challenge");
      await page.fill(`#species-answer-${CRAB}`, "Crab").catch(() => {});
      const confirm = page.getByRole("button", { name: /confirm selection/i });
      await confirm.first().click({ timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(1800);
      await shot(page, "snippet-02-reveal-correct");
    } catch (e) {
      console.log(`SNIPPET ERR ${(e as Error).message.slice(0, 120)}`);
    }
    await ctx.close();
  }

  // ---- E. Desktop feed idle + shape gate ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE}/feed`, { waitUntil: "networkidle", timeout: 45000 });
      await dismissCookie(page);
      await page.waitForTimeout(2000);
      await shot(page, "d-feed-01-idle");
      await page.locator('button[aria-label="Identify this species"]').first().click({ timeout: 8000 });
      await page.waitForTimeout(1200);
      await shot(page, "d-feed-02-shapegate");
    } catch (e) {
      console.log(`DESKTOP-FEED ERR ${(e as Error).message.slice(0, 120)}`);
    }
    await ctx.close();
  }

  await browser.close();
  console.log("feed capture done");
})();
