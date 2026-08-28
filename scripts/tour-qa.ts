/**
 * Wave-4 visual QA for the first-run tour (temporary harness, 28 Aug 2026).
 *
 * Drives a real browser through the whole six-step tour and screenshots every
 * beat, because the tour only mounts for a signed-in user with `onboardedAt`
 * null and cannot be reached from a story or a unit test. It mints its own
 * throwaway guest through the real GuestGate, so nothing here needs a fixture
 * or a seeded session.
 *
 * Run: node node_modules/tsx/dist/cli.mjs scripts/tour-qa.ts [--base URL]
 * Delete this file, and the guests it makes, once the tour is signed off.
 */
import { chromium, type Page, type Browser } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : "http://localhost:3210";
const OUT = join(process.cwd(), "implementation", "2026-08-28", "tour-qa");
mkdirSync(OUT, { recursive: true });

const CAPTION = '[aria-label="Getting started"]';
const shots: string[] = [];

async function shot(page: Page, name: string) {
  const file = join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  shots.push(name);
  const caption = await page.locator(CAPTION).first().innerText().catch(() => "(no caption)");
  console.log(`  [shot] ${name} :: ${caption.split("\n")[0]}`);
}

/** Mint a fresh guest through the real username gate, then hard-reload so the
 *  server component recomputes needsTour with a session in hand. */
async function signInAsGuest(page: Page, username: string) {
  await page.goto(`${BASE}/feed`, { waitUntil: "domcontentloaded" });
  // The cookie notice is bottom-anchored and, on a 390px viewport, sits right on
  // top of the sign-in button. Take the privacy-preserving option, as a real
  // careful user would; analytics consent is irrelevant to the tour.
  // Wait for it rather than probing immediately: it is a client component that
  // only appears after hydration, so an isVisible() check on domcontentloaded
  // always missed it and the click below then failed on a 390px viewport.
  const banner = page.locator('[aria-label="Cookie notice"]');
  if (await banner.waitFor({ timeout: 20_000 }).then(() => true).catch(() => false)) {
    await banner.getByRole("button", { name: /essential only/i }).click();
    await banner.waitFor({ state: "detached", timeout: 10_000 }).catch(() => {});
  }
  const input = page.getByPlaceholder("e.g. ReefRanger");
  await input.waitFor({ timeout: 60_000 });
  await input.fill(username);
  await page.getByRole("button", { name: "Start spotting" }).click();

  // Wait for the session to actually exist rather than guessing at a delay: the
  // guest is minted server-side and the tour is gated on it.
  for (let i = 0; i < 40; i++) {
    const ok = await page.evaluate(() =>
      fetch("/api/auth/session").then((r) => r.json()).then((s) => !!s?.user?.id).catch(() => false),
    );
    if (ok) break;
    await page.waitForTimeout(500);
  }

  // Hard reload so the server component recomputes needsTour with a session in
  // hand, then give a cold dev-server compile a couple of chances.
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`${BASE}/feed`, { waitUntil: "domcontentloaded" });
    try {
      await page.locator(CAPTION).first().waitFor({ timeout: 45_000 });
      return;
    } catch {
      const session = await page.evaluate(() =>
        fetch("/api/auth/session").then((r) => r.json()).catch(() => null),
      );
      console.log(`  [retry ${attempt + 1}] no caption yet; session=${JSON.stringify(session?.user ?? null)}`);
    }
  }
  throw new Error("tour never mounted");
}

async function stepText(page: Page): Promise<string> {
  return (await page.locator(CAPTION).first().innerText()).split("\n")[0];
}

/** Is the caption fully inside the viewport? The bug this QA found was a card
 *  rendered at top:-245, i.e. running perfectly and invisible. */
async function assertOnScreen(page: Page, label: string) {
  const box = await page.locator(CAPTION).first().boundingBox();
  const vh = page.viewportSize()?.height ?? 0;
  const vw = page.viewportSize()?.width ?? 0;
  if (!box) throw new Error(`${label}: caption has no box`);
  const ok = box.y >= 0 && box.x >= 0 && box.y + box.height <= vh + 1 && box.x + box.width <= vw + 1;
  console.log(
    `  [caption] ${label}: ${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)} in ${vw}x${vh} -> ${ok ? "ON SCREEN" : "OFF SCREEN"}`,
  );
  if (!ok) throw new Error(`${label}: caption is off screen`);
}

/** The spotlight hole, read off the mask rect the Spotlight component animates. */
async function holeRect(page: Page) {
  return page.evaluate(() => {
    const r = document.querySelector("mask rect:last-of-type") as SVGRectElement | null;
    if (!r) return null;
    const b = r.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
  });
}

async function walk(page: Page, tag: string) {
  // ---- Step 1: the clip -------------------------------------------------
  await page.waitForTimeout(1200);
  console.log(` step: ${await stepText(page)}`);
  await assertOnScreen(page, `${tag}/step1`);
  console.log(`  [hole] ${JSON.stringify(await holeRect(page))}`);
  await shot(page, `${tag}-1-clip`);

  // ---- Step 2: the shape gate -------------------------------------------
  await page.locator('button[aria-label="Identify this species"]').first().click();
  await page.locator('[data-tour-tile="crab"]').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1400);
  console.log(` step: ${await stepText(page)}`);
  await assertOnScreen(page, `${tag}/step2`);
  await shot(page, `${tag}-2-shape`);

  // Is the ghost cursor actually aimed at the Crab tile it is recommending?
  const aim = await page.evaluate(() => {
    const tile = document.querySelector('[data-tour-tile="crab"]');
    const cur = [...document.querySelectorAll("div")].find(
      (d) => typeof d.className === "string" && d.className.includes("z-[112]"),
    );
    if (!tile || !cur) return { tile: !!tile, cursor: !!cur };
    const t = tile.getBoundingClientRect();
    const c = cur.getBoundingClientRect();
    return {
      onTile:
        c.left + c.width / 2 >= t.left &&
        c.left + c.width / 2 <= t.right &&
        c.top + c.height / 2 >= t.top &&
        c.top + c.height / 2 <= t.bottom,
    };
  });
  console.log(`  [cursor] aimed at crab tile: ${JSON.stringify(aim)}`);

  // ---- Step 3: the crab sub-split ---------------------------------------
  await page.locator('[data-tour-tile="crab"]').click();
  await page.locator('[data-tour-tile="broad-carapace"]').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1400);
  console.log(` step: ${await stepText(page)}`);
  await assertOnScreen(page, `${tag}/step3`);
  await shot(page, `${tag}-3-form`);

  // ---- Step 4: the candidate grid ---------------------------------------
  await page.locator('[data-tour-tile="broad-carapace"]').click();
  await page.locator('[data-tour="compare"]').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1600);
  console.log(` step: ${await stepText(page)}`);
  await assertOnScreen(page, `${tag}/step4`);
  await shot(page, `${tag}-4-candidates`);

  // ---- Step 5a: the side-by-side ----------------------------------------
  await page.locator('[data-tour="compare"]').click();
  await page.locator('[data-tour="comparison"]').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1400);
  console.log(` step: ${await stepText(page)}`);
  await assertOnScreen(page, `${tag}/step5-comparison`);
  await shot(page, `${tag}-5a-comparison`);

  // ---- Step 5b: the species page ----------------------------------------
  await page.locator('[data-tour="comparison"] button[aria-label="Back to the list"]').click();
  await page.waitForTimeout(1200);
  await page.locator('[data-tour-tile="Necora puber"]').click();
  await page.locator('[data-tour="species-guide"]').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1400);
  console.log(` step: ${await stepText(page)}`);
  await assertOnScreen(page, `${tag}/step5-guide`);
  await shot(page, `${tag}-5b-guide`);

  // ---- Step 6: commit, then the reveal ----------------------------------
  await page.locator('[data-tour="species-guide"] button:has-text("This is my pick")').click();
  await page.locator('[data-tour="reveal"]').waitFor({ timeout: 60_000 });
  await page.waitForTimeout(2200);
  console.log(` step: ${await stepText(page)}`);
  await assertOnScreen(page, `${tag}/step6`);
  await shot(page, `${tag}-6-reveal`);

  // ---- The coda: the pebbles hint ---------------------------------------
  await page.getByRole("button", { name: "Done" }).click();
  await page.waitForTimeout(1800);
  // The header bag is ALSO a /pebbles link, so target the callout by its copy.
  const hint = await page
    .locator('a[href="/pebbles"]:has-text("pay more")')
    .first()
    .innerText()
    .catch(() => "(none)");
  console.log(`  [coda] ${hint.replace(/\n/g, " ").slice(0, 90)}`);
  console.log(`  [coda] blocks the feed: ${await page.evaluate(() => {
    const el = document.querySelector('[data-tour="pebbles"]');
    if (!el) return "no bag";
    const b = el.getBoundingClientRect();
    // What does a tap in the MIDDLE of the feed hit? If the coda were modal it
    // would answer with the callout instead of the clip.
    const hit = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    return hit?.closest('a[href="/pebbles"]') ? "YES (bad)" : "no (good)";
  })}`);
  await shot(page, `${tag}-7-coda`);
  console.log(`  [done] tour completed, caption gone: ${(await page.locator(CAPTION).count()) === 0}`);
}

async function main() {
  const browser: Browser = await chromium.launch();
  const stamp = Date.now().toString().slice(-5);
  try {
    // ---- Desktop --------------------------------------------------------
    console.log("\n=== DESKTOP 1280x900 ===");
    let ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    let page = await ctx.newPage();
    await signInAsGuest(page, `TourQAd${stamp}`);
    await walk(page, "desktop");
    await ctx.close();

    // ---- Mobile ---------------------------------------------------------
    console.log("\n=== MOBILE 390x844 ===");
    ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    page = await ctx.newPage();
    await signInAsGuest(page, `TourQAm${stamp}`);
    await walk(page, "mobile");
    await ctx.close();

    // ---- Reduced motion, plus the keyboard contract ---------------------
    console.log("\n=== REDUCED MOTION 1280x900 ===");
    ctx = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: "reduce",
    });
    page = await ctx.newPage();
    await signInAsGuest(page, `TourQAr${stamp}`);
    await page.waitForTimeout(1500);
    await assertOnScreen(page, "reduced/step1");
    console.log(
      `  [reduced] ghost cursor rendered: ${await page.evaluate(
        () =>
          [...document.querySelectorAll("div")].some(
            (d) => typeof d.className === "string" && d.className.includes("z-[112]"),
          ),
      )} (expected false)`,
    );
    await shot(page, "reduced-1-clip");

    // Focus must NOT be trapped: the tour points at live controls, so a Tab
    // from the caption has to be able to reach the app underneath.
    await page.locator(`${CAPTION} button:has-text("Skip")`).focus();
    const reached: string[] = [];
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      reached.push(
        await page.evaluate(() => {
          const a = document.activeElement as HTMLElement | null;
          if (!a) return "none";
          const inCaption = !!a.closest('[aria-label="Getting started"]');
          return `${inCaption ? "caption" : "APP"}:${(a.getAttribute("aria-label") || a.textContent || a.tagName).trim().slice(0, 28)}`;
        }),
      );
    }
    console.log(`  [keyboard] tab order: ${reached.join(" -> ")}`);
    console.log(
      `  [keyboard] escaped the caption into the app: ${reached.some((r) => r.startsWith("APP"))} (expected true)`,
    );

    // Escape skips the tour.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1200);
    console.log(
      `  [keyboard] Escape dismissed the tour: ${(await page.locator(CAPTION).count()) === 0} (expected true)`,
    );
    await ctx.close();
  } finally {
    await browser.close();
  }
  console.log(`\n${shots.length} screenshots in ${OUT}`);
}

main().catch((e) => {
  console.error("QA FAILED:", e);
  process.exit(1);
});
