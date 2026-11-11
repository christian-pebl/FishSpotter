/* eslint-disable */
/**
 * What a first-time, signed-out visitor pays for while the guest gate (the age
 * question) is still on screen, and whether they can reach its buttons.
 *
 *   node scripts/bench/measure-gate-bytes.cjs <baseURL> [label] [shotDir]
 *   npm run bench:gate -- https://www.fishspotter.app PROD
 *
 * For a phone (390x844) and a desktop (1440x900) it opens /feed in a fresh
 * browser profile, waits for the gate, then reports:
 *
 *   - video bytes and requests fetched while the gate is up (should be 0: the
 *     visitor has not chosen to watch anything yet);
 *   - which of the gate's controls the cookie banner covers (should be none);
 *   - that the clip does start, and video does arrive, once "Just watch for
 *     now" is tapped (so holding the video back never strands the feed).
 *
 * Runs in real Chrome when it is installed (`channel: "chrome"`), because
 * Playwright's bundled Chromium has no H.264 decoder and gives up on a clip
 * after sniffing it, which under-counts the bytes a real visitor downloads.
 * Compare only runs from the same machine and network.
 */
const { chromium } = require("@playwright/test");
const path = require("node:path");
const fs = require("node:fs");

const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const label = process.argv[3] || "";
const shotDir = process.argv[4] || "";
/** How long to leave the gate up before counting. Long enough for a
 *  `preload="auto"` clip to be pulled in full on a fast line. */
const GATE_DWELL_MS = Number(process.env.GATE_DWELL_MS || 12000);
const AFTER_DISMISS_MS = Number(process.env.AFTER_DISMISS_MS || 6000);

const PROFILES = [
  {
    name: "phone",
    context: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  },
  { name: "desktop", context: { viewport: { width: 1440, height: 900 } } },
];

const isVideo = (url, type) => type === "Media" || /\.(mp4|webm|mov)(\?|$)/i.test(url);
const mb = (bytes) => (bytes / 1048576).toFixed(2) + " MB";

async function launch() {
  try {
    return { browser: await chromium.launch({ channel: "chrome" }), engine: "Chrome" };
  } catch {
    return { browser: await chromium.launch(), engine: "bundled Chromium (no H.264: bytes under-counted)" };
  }
}

(async () => {
  const { browser, engine } = await launch();
  console.log(`\n${label ? label + ": " : ""}${base}/feed, fresh signed-out profile, ${engine}`);
  let failed = false;

  for (const profile of PROFILES) {
    const context = await browser.newContext(profile.context);
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");

    // requestId -> { url, type, bytes }
    const requests = new Map();
    cdp.on("Network.requestWillBeSent", (e) => {
      requests.set(e.requestId, { url: e.request.url, type: e.type, bytes: 0 });
    });
    cdp.on("Network.responseReceived", (e) => {
      const r = requests.get(e.requestId);
      if (r) r.type = e.type;
    });
    cdp.on("Network.dataReceived", (e) => {
      const r = requests.get(e.requestId);
      if (r) r.bytes += e.encodedDataLength;
    });
    const videoTotals = () => {
      let bytes = 0;
      let count = 0;
      for (const r of requests.values()) {
        if (!isVideo(r.url, r.type)) continue;
        count += 1;
        bytes += r.bytes;
      }
      return { bytes, count };
    };

    await page.goto(base + "/feed", { waitUntil: "load" });
    const gate = page.locator('[role="dialog"][aria-labelledby="guest-gate-title"]');
    await gate.waitFor({ state: "visible", timeout: 60000 });
    await page.waitForTimeout(GATE_DWELL_MS);

    const behindGate = videoTotals();

    // Which gate controls does the cookie banner sit on top of?
    const covered = await page.evaluate(() => {
      const banner = document.querySelector('[role="region"][aria-label="Cookie notice"]');
      const dialog = document.querySelector('[role="dialog"][aria-labelledby="guest-gate-title"]');
      if (!dialog) return { banner: !!banner, covered: ["(no gate)"], controls: 0 };
      const controls = Array.from(dialog.querySelectorAll("button, a, input"));
      if (!banner) return { banner: false, covered: [], controls: controls.length };
      const b = banner.getBoundingClientRect();
      const hit = [];
      for (const el of controls) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const overlaps = r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top;
        // The banner is later in the stacking order (z-60 over z-50), so any
        // overlap means the banner takes the tap.
        if (overlaps) hit.push((el.textContent || el.getAttribute("aria-label") || el.tagName).trim());
      }
      return { banner: true, covered: hit, controls: controls.length };
    });
    const offscreen = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"][aria-labelledby="guest-gate-title"]');
      if (!dialog) return [];
      const out = [];
      for (const el of dialog.querySelectorAll("button, a, input")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.top < 0 || r.bottom > window.innerHeight) out.push((el.textContent || "").trim());
      }
      return out;
    });

    if (shotDir) {
      fs.mkdirSync(shotDir, { recursive: true });
      await page.screenshot({ path: path.join(shotDir, `${label || "run"}-${profile.name}-gate.png`) });
    }

    // Dismiss the gate the way a visitor would, then confirm the feed plays.
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"][aria-labelledby="guest-gate-title"]');
      const btn = Array.from(dialog?.querySelectorAll("button") ?? []).find((b) =>
        /just watch/i.test(b.textContent || ""),
      );
      btn?.click();
    });
    await gate.waitFor({ state: "hidden", timeout: 10000 });
    await page.waitForTimeout(AFTER_DISMISS_MS);
    const afterDismiss = videoTotals();
    const playing = await page.evaluate(() => {
      const v = document.querySelector('[data-feed-index="0"] video');
      return v ? { hasSrc: !!v.currentSrc, readyState: v.readyState, currentTime: v.currentTime, paused: v.paused } : null;
    });
    if (shotDir) {
      await page.screenshot({ path: path.join(shotDir, `${label || "run"}-${profile.name}-after.png`) });
    }

    const arrived = afterDismiss.bytes - behindGate.bytes;
    console.log(`\n  ${profile.name} (${profile.context.viewport.width}x${profile.context.viewport.height})`);
    console.log(`    video behind the gate, ${GATE_DWELL_MS / 1000}s:  ${mb(behindGate.bytes)} in ${behindGate.count} request(s)`);
    console.log(`    gate controls under the banner: ${covered.covered.length ? covered.covered.join(" | ") : "none"}${covered.banner ? "" : " (no banner shown)"}`);
    console.log(`    gate controls off screen:       ${offscreen.length ? offscreen.join(" | ") : "none"}`);
    console.log(`    after "Just watch", ${AFTER_DISMISS_MS / 1000}s:        ${mb(arrived)} more video; clip ${playing && playing.hasSrc ? "attached" : "NOT attached"}, readyState ${playing ? playing.readyState : "n/a"}, t=${playing ? playing.currentTime.toFixed(1) : "n/a"}s`);

    if (behindGate.bytes > 0 || covered.covered.length || offscreen.length || !playing || !playing.hasSrc) failed = true;
    await context.close();
  }

  await browser.close();
  console.log(failed ? "\n  RESULT: at least one check above is not clean.\n" : "\n  RESULT: clean.\n");
  // Reporting tool, not a gate: exit 0 either way unless asked to be strict.
  if (failed && process.env.STRICT === "1") process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
