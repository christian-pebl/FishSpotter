/* eslint-disable */
/**
 * How many bytes of VIDEO the feed actually serves, mobile vs desktop, at the
 * network layer. `bench:load` counts DOM nodes and load timing; this counts
 * what the browser downloaded for the `<video>` element specifically, which
 * is what the 720p rendition changes and the others don't.
 *
 *   node scripts/bench/measure-clip-bytes.cjs <baseURL> [label]
 *   npm run bench:clips -- https://www.fishspotter.app PROD
 *
 * Opens /feed once at a phone viewport and once at a desktop viewport, lets
 * the active card's clip load and play briefly, and reports the response
 * size of every request whose URL matches a snippet video (master or SD).
 */
const { chromium, devices } = require("@playwright/test");

const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const label = process.argv[3] || "";

// Real device descriptors, not a bare viewport size: the server-side device
// guess (src/lib/device-guess.ts) reads the request's real User-Agent, and a
// manually-sized context with no `userAgent` set sends the desktop Chromium
// UA regardless of viewport, which would make the "phone" pass here exercise
// a UA/viewport MISMATCH no real phone has, rather than the real path. Same
// "Pixel 7" descriptor `playwright.config.ts` uses for the mobile project.
const VIEWPORTS = [
  { name: "phone (Pixel 7)", device: devices["Pixel 7"] },
  { name: "desktop 1280x800", device: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
];

async function measure(browser, vp) {
  const context = await browser.newContext({ ...vp.device });
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem("fishspotter:guestGateDismissed", "1");
      localStorage.setItem("fishspotter:tapHintSeen", "1");
      localStorage.setItem("fishspotter:navHintSeen", "1");
    } catch {}
  });
  const page = await context.newPage();
  const clipRequests = [];
  page.on("response", async (res) => {
    const url = res.url();
    if (!/\/(snippet(_720)?\.mp4)(\?|$)/.test(url)) return;
    const len = res.headers()["content-length"];
    clipRequests.push({
      url,
      rendition: url.includes("snippet_720.mp4") ? "sd" : "master",
      bytes: len ? parseInt(len, 10) : null,
    });
  });
  await page.goto(base + "/feed", { waitUntil: "load" });
  // Let the active card's video actually attach and start buffering.
  await page.waitForTimeout(3000);
  const src = await page.evaluate(() => {
    const v = document.querySelector('[data-feed-index="0"] video');
    return v ? v.currentSrc || v.src : null;
  });
  await context.close();
  return { src, clipRequests };
}

(async () => {
  const browser = await chromium.launch();
  for (const vp of VIEWPORTS) {
    const { src, clipRequests } = await measure(browser, vp);
    console.log(`\n== ${label} ${vp.name} ==`);
    console.log(`  active card src: ${src}`);
    if (!clipRequests.length) {
      console.log("  no snippet video requests observed (video may not have started loading yet)");
      continue;
    }
    for (const r of clipRequests) {
      console.log(`  ${r.rendition.padEnd(6)} ${r.bytes ? (r.bytes / 1024).toFixed(0) + "KB" : "?"}  ${r.url.slice(-90)}`);
    }
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
