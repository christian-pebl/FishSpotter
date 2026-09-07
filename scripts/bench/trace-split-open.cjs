/* eslint-disable */
/**
 * Frame-by-frame record of what the feed paints when the identify panel opens,
 * at a laptop, a landscape tablet and a phone viewport.
 *
 *   node scripts/bench/trace-split-open.cjs <baseURL> [label]
 *   npm run bench:split -- https://www.fishspotter.app PROD
 *
 * Each line is a painted frame whose state differs from the previous one: which
 * resize handle exists (the docked seam or the sheet grip), the clip inset on
 * the document element, the dialog's rect and the video's rect. This is how the
 * 7 Sep 2026 sheet-then-dock flash was measured and proven gone; a settled-state
 * check cannot see it, because by the time it looks the layout has corrected
 * itself. `tests/e2e/split-orientation.spec.ts` asserts the same sequence.
 */
const { chromium } = require("@playwright/test");

const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const label = process.argv[3] || "";

const VIEWPORTS = [
  { name: "laptop 1280x800", width: 1280, height: 800, touch: false },
  { name: "tablet landscape 1024x768", width: 1024, height: 768, touch: true },
  { name: "phone 390x844", width: 390, height: 844, touch: true },
];

const RECORDER = `
(() => {
  window.__fsTrace = [];
  window.__fsTracing = false;
  let last = "";
  let frame = 0;
  const sample = () => {
    frame += 1;
    if (window.__fsTracing) {
      const art = document.querySelector('[data-feed-index="0"] article');
      const dlg = document.querySelector('[role="dialog"][aria-modal="false"]');
      const grip = !!document.querySelector('[aria-label="Drag to resize this panel and see more of the clip"]');
      const seam = !!document.querySelector('[aria-label="Resize this panel"]');
      const vid = art ? art.querySelector('video') : null;
      const vr = vid ? vid.getBoundingClientRect() : null;
      const dr = dlg ? dlg.getBoundingClientRect() : null;
      const root = document.documentElement.style;
      const state = {
        gateLeft: root.getPropertyValue('--gate-left'),
        gateBottom: root.getPropertyValue('--gate-bottom'),
        dialog: dr ? [Math.round(dr.left), Math.round(dr.top), Math.round(dr.width), Math.round(dr.height)] : null,
        handle: seam ? 'seam(docked)' : grip ? 'grip(sheet)' : 'none',
        video: vr ? [Math.round(vr.left), Math.round(vr.top), Math.round(vr.width), Math.round(vr.height)] : null,
      };
      const key = JSON.stringify(state);
      if (key !== last) {
        last = key;
        window.__fsTrace.push({ frame, t: Math.round(performance.now() - window.__fsT0), ...state });
      }
    }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
})();
`;

(async () => {
  const browser = await chromium.launch();
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: vp.touch,
      isMobile: vp.touch && vp.width < 800,
      deviceScaleFactor: 1,
    });
    await context.addInitScript(() => {
      try {
        sessionStorage.setItem("fishspotter:guestGateDismissed", "1");
        localStorage.setItem("fishspotter:tapHintSeen", "1");
        localStorage.setItem("fishspotter:navHintSeen", "1");
      } catch {}
    });
    await context.addInitScript(RECORDER);
    const page = await context.newPage();
    // domcontentloaded, not networkidle: the clip keeps streaming, so the
    // network never goes idle; the catcher wait is the real gate.
    await page.goto(base + "/feed", { waitUntil: "domcontentloaded" });
    const catcher = page.locator('[data-feed-index="0"] button[aria-label="Identify this species"]');
    await catcher.waitFor({ state: "visible", timeout: 60000 });
    await page.waitForTimeout(500);

    for (let n = 1; n <= 2; n += 1) {
      await page.evaluate(() => {
        window.__fsTrace = [];
        window.__fsT0 = performance.now();
        window.__fsTracing = true;
      });
      await catcher.click();
      await page.waitForTimeout(900);
      const trace = await page.evaluate(() => {
        window.__fsTracing = false;
        return window.__fsTrace;
      });
      console.log(`\n== ${label} ${vp.name} :: open #${n} ==`);
      for (const s of trace) {
        console.log(
          `  f${String(s.frame).padStart(4)} t=${String(s.t).padStart(4)}ms  handle=${s.handle.padEnd(12)}` +
            ` gate-left=${(s.gateLeft || "-").padEnd(6)} gate-bottom=${(s.gateBottom || "-").padEnd(6)}` +
            ` dialog=${s.dialog ? s.dialog.join(",") : "-"}  video=${s.video ? s.video.join(",") : "-"}`,
        );
      }
      await page.locator('button[aria-label="Close the selector"]').first().click();
      await page.waitForTimeout(600);
    }
    await context.close();
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
