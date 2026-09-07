/* eslint-disable */
/**
 * The feed as a phone feels it: 390x844, 4x CPU throttling, headless Chromium.
 *
 *   node scripts/bench/measure-phone.cjs <baseURL> [label] [runs]
 *   npm run bench:phone -- https://www.fishspotter.app PROD 3
 *
 * Reports medians of: DOMContentLoaded, load, the time until the clip's
 * "Identify this species" catcher is visible (the first thing a spotter can
 * tap), the tap-to-panel latency (click until the split dialog exists, measured
 * with requestAnimationFrame inside the page), long tasks and blocking time,
 * DOM size and heap. Same caveat as measure-load.cjs: compare only runs from
 * the same machine against the same target.
 */
const { chromium } = require("@playwright/test");

const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const label = process.argv[3] || "";
const runs = Number(process.argv[4] || 3);
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

(async () => {
  const browser = await chromium.launch();
  const out = [];
  for (let i = 0; i < runs; i++) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    await context.addInitScript(() => {
      try {
        sessionStorage.setItem("fishspotter:guestGateDismissed", "1");
        localStorage.setItem("fishspotter:tapHintSeen", "1");
        localStorage.setItem("fishspotter:navHintSeen", "1");
      } catch {}
      window.__longTasks = [];
      try {
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) window.__longTasks.push(e.duration);
        }).observe({ type: "longtask", buffered: true });
      } catch {}
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const t0 = Date.now();
    await page.goto(base + "/feed", { waitUntil: "load" });
    const catcher = page.locator('[data-feed-index="0"] button[aria-label="Identify this species"]');
    await catcher.waitFor({ state: "visible", timeout: 60000 });
    const tCatcher = Date.now() - t0;
    await page.waitForTimeout(2500);
    const m = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const long = window.__longTasks || [];
      return {
        dcl: Math.round(nav.domContentLoadedEventEnd),
        load: Math.round(nav.loadEventEnd),
        longTasks: long.length,
        longTotal: Math.round(long.reduce((a, d) => a + d, 0)),
        tbt: Math.round(long.reduce((a, d) => a + Math.max(0, d - 50), 0)),
        domNodes: document.getElementsByTagName("*").length,
        heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
      };
    });
    const tap = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const btn = document.querySelector('[data-feed-index="0"] button[aria-label="Identify this species"]');
          const t0 = performance.now();
          btn.click();
          const check = () => {
            if (document.querySelector('[role="dialog"][aria-modal="false"]')) resolve(Math.round(performance.now() - t0));
            else if (performance.now() - t0 > 5000) resolve(-1);
            else requestAnimationFrame(check);
          };
          requestAnimationFrame(check);
        }),
    );
    out.push({ tCatcher, tapToPanel: tap, ...m });
    await context.close();
  }
  const med = {};
  for (const k of Object.keys(out[0])) med[k] = median(out.map((o) => o[k]).filter((v) => typeof v === "number"));
  console.log(`== ${label} /feed phone 390x844, CPU 4x (median of ${out.length}) ==`);
  console.log(
    `  dcl=${med.dcl}ms load=${med.load}ms interactive(catcher)=${med.tCatcher}ms tapToPanel=${med.tapToPanel}ms` +
      ` longTasks=${med.longTasks} (${med.longTotal}ms, TBT ${med.tbt}ms) domNodes=${med.domNodes} heap=${med.heapMB}MB`,
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
