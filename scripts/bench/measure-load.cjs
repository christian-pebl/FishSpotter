/* eslint-disable */
/**
 * Load benchmark: navigation timings, payload, DOM size and main-thread cost
 * for the main routes, against any running server.
 *
 *   node scripts/bench/measure-load.cjs <baseURL> [label] [runs]
 *   npm run bench:load -- https://www.fishspotter.app PROD 3
 *
 * Reports the MEDIAN of `runs` cold loads per route at 1280x800 in headless
 * Chromium. Numbers between two machines or two networks are not comparable;
 * numbers from the same machine against the same target before and after a
 * change are, which is the only use this has. Results live in
 * implementation/<date>/load-benchmark.md.
 *
 * What the columns mean:
 *   ttfb      request start to first byte (a streamed shell answers early)
 *   dcl/load  DOMContentLoaded / load event, ms from navigation start
 *   html      compressed HTML bytes
 *   js        script files / compressed KB
 *   domNodes  elements in the document 1.5 s after load
 *   videos    <video> elements in the DOM (iOS Safari rations these)
 *   longTasks main-thread tasks over 50 ms, their total, and the blocking
 *             time (the part of each over 50 ms), i.e. hydration cost
 *   heap      JS heap after load, MB
 */
const { chromium } = require("@playwright/test");

const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const label = process.argv[3] || "";
const runs = Number(process.argv[4] || 3);

const ROUTES = ["/feed", "/feed/browse", "/species", "/"];

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};

async function measure(page, route) {
  await page.addInitScript(() => {
    window.__longTasks = [];
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__longTasks.push(e.duration);
      }).observe({ type: "longtask", buffered: true });
    } catch {}
  });
  const t0 = Date.now();
  await page.goto(base + route, { waitUntil: "load" });
  const loadWall = Date.now() - t0;
  await page.waitForTimeout(1500);
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const res = performance.getEntriesByType("resource");
    const scripts = res.filter((r) => r.initiatorType === "script" || /\.js(\?|$)/.test(r.name));
    const jsBytes = scripts.reduce((a, r) => a + (r.encodedBodySize || 0), 0);
    const long = window.__longTasks || [];
    return {
      ttfb: Math.round(nav.responseStart - nav.requestStart),
      htmlKB: Math.round(nav.encodedBodySize / 1024),
      dcl: Math.round(nav.domContentLoadedEventEnd),
      load: Math.round(nav.loadEventEnd),
      domNodes: document.getElementsByTagName("*").length,
      videos: document.getElementsByTagName("video").length,
      requests: res.length,
      jsFiles: scripts.length,
      jsKB: Math.round(jsBytes / 1024),
      longTasks: long.length,
      longTotal: Math.round(long.reduce((a, d) => a + d, 0)),
      tbt: Math.round(long.reduce((a, d) => a + Math.max(0, d - 50), 0)),
      heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
    };
  });
  return { loadWall, ...m };
}

(async () => {
  const browser = await chromium.launch();
  for (const route of ROUTES) {
    const samples = [];
    for (let i = 0; i < runs; i++) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
      await context.addInitScript(() => {
        try {
          sessionStorage.setItem("fishspotter:guestGateDismissed", "1");
          localStorage.setItem("fishspotter:tapHintSeen", "1");
          localStorage.setItem("fishspotter:navHintSeen", "1");
        } catch {}
      });
      const page = await context.newPage();
      try {
        samples.push(await measure(page, route));
      } catch (e) {
        console.log(`  ${route} run ${i} failed: ${String(e).slice(0, 200)}`);
      }
      await context.close();
    }
    if (!samples.length) continue;
    const med = {};
    for (const k of Object.keys(samples[0])) {
      const vals = samples.map((s) => s[k]).filter((v) => typeof v === "number");
      med[k] = vals.length ? median(vals) : samples[0][k];
    }
    console.log(`\n== ${label} ${route} (median of ${samples.length}) ==`);
    console.log(
      `  ttfb=${med.ttfb}ms dcl=${med.dcl}ms load=${med.load}ms html=${med.htmlKB}KB` +
        ` requests=${med.requests} js=${med.jsFiles} files/${med.jsKB}KB domNodes=${med.domNodes} videos=${med.videos}` +
        ` longTasks=${med.longTasks} (${med.longTotal}ms total, TBT ${med.tbt}ms) heap=${med.heapMB}MB`,
    );
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
