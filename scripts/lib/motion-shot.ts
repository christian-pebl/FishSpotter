/**
 * Playwright capture for the MOTION-review loop (sibling of ui-shot.ts).
 *
 * ui-shot captures one settled frame. To validate an animation you need the
 * ARC, so this triggers a moment (a click, or a bit of setup JS) and captures a
 * filmstrip of frames at given millisecond offsets, then optionally captures the
 * same moment a second time with reduced-motion emulated (the resting state a
 * motion-averse user sees). Returns base64 for each frame for motion-critique.ts.
 *
 * Capture timing is best-effort: page.screenshot itself costs ~30-80ms, so the
 * frames sample the arc rather than hit exact offsets. That is fine for an
 * advisory visual critique. For a moment that is hard to reach on a live route
 * (e.g. a species-unlock that needs DB state), point --route at a Storybook
 * story or a route that honours a demo query param, and trigger with --eval.
 *
 * Requires the chromium binary: `npx playwright install chromium`.
 */
import * as fs from "fs";
import * as path from "path";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";

export type Viewport = "mobile" | "desktop";

const VIEWPORTS: Record<Viewport, { width: number; height: number; label: string }> = {
  mobile: { width: 390, height: 844, label: "mobile 390x844" },
  desktop: { width: 1280, height: 800, label: "desktop 1280x800" },
};

export type Frame = { ms: number; base64: string; pngPath: string };

export type Trigger = {
  /** CSS selector to click to start the animation (e.g. a submit button or tile). */
  click?: string;
  /** JS to run in the page to start/seed the animation (e.g. dispatch an event). */
  eval?: string;
};

type PrepArgs = {
  route: string;
  baseURL: string;
  waitFor?: string;
  pauseVideo: boolean;
};

async function openContext(
  browser: Browser,
  vp: { width: number; height: number },
  baseURL: string,
  reducedMotion: boolean,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    // Playwright honours this as the OS "reduce motion" media setting.
    reducedMotion: reducedMotion ? "reduce" : "no-preference",
  });
  // Pre-seed the privacy consent cookie so the banner never covers the frame.
  await context.addCookies([
    {
      name: "pebl_consent",
      value: encodeURIComponent(JSON.stringify({ v: 1, necessary: true })),
      domain: new URL(baseURL).hostname,
      path: "/",
    },
  ]);
  return context;
}

async function prep(page: Page, args: PrepArgs): Promise<void> {
  await page.goto(`${args.baseURL}${args.route}`, { waitUntil: "networkidle", timeout: 75_000 });
  if (args.waitFor) {
    await page.waitForSelector(args.waitFor, { timeout: 15_000 }).catch(() => {});
  }
  if (args.pauseVideo) {
    // Freeze any autoplaying feed clip so the critique judges the animation,
    // not the underlying footage moving.
    await page.evaluate(() => {
      document.querySelectorAll("video").forEach((v) => {
        try { v.pause(); v.currentTime = Math.min(1, v.duration || 1); } catch { /* noop */ }
      });
    });
  }
}

async function fire(page: Page, trigger?: Trigger): Promise<void> {
  if (!trigger) return;
  if (trigger.eval) {
    await page.evaluate(trigger.eval).catch(() => {});
  }
  if (trigger.click) {
    await page.locator(trigger.click).first().click({ timeout: 5_000 }).catch(() => {});
  }
}

/** Capture a filmstrip of frames at the given ms offsets after the trigger. */
export async function filmstrip(args: {
  route: string;
  outDir: string;
  frames: number[];
  trigger?: Trigger;
  viewport?: Viewport;
  baseURL?: string;
  waitFor?: string;
  /** Clip every frame to this element; otherwise the full viewport. */
  selector?: string;
  pauseVideo?: boolean;
  label?: string;
}): Promise<{ frames: Frame[]; viewportLabel: string }> {
  const vp = VIEWPORTS[args.viewport ?? "mobile"];
  const baseURL = args.baseURL ?? "http://localhost:3000";
  const label = args.label ?? "anim";
  const browser = await chromium.launch();
  try {
    const context = await openContext(browser, vp, baseURL, false);
    const page = await context.newPage();
    await prep(page, { route: args.route, baseURL, waitFor: args.waitFor, pauseVideo: args.pauseVideo ?? true });

    const target = args.selector ? page.locator(args.selector).first() : page;
    const offsets = [...args.frames].sort((a, b) => a - b);
    fs.mkdirSync(args.outDir, { recursive: true });

    const frames: Frame[] = [];
    await fire(page, args.trigger);
    const t0 = Date.now();
    for (const ms of offsets) {
      const elapsed = Date.now() - t0;
      if (ms > elapsed) await page.waitForTimeout(ms - elapsed);
      const pngPath = path.join(args.outDir, `${label}.${args.viewport ?? "mobile"}.${ms}ms.png`);
      // The clipped element can detach mid-animation (e.g. a gate advancing to
      // the next rung swaps the [role=dialog] node), so fall back to a full
      // viewport frame rather than crashing the run.
      let buf: Buffer;
      try {
        buf = await target.screenshot({ path: pngPath });
      } catch {
        buf = await page.screenshot({ path: pngPath });
      }
      frames.push({ ms, base64: buf.toString("base64"), pngPath });
    }
    return { frames, viewportLabel: vp.label };
  } finally {
    await browser.close();
  }
}

/** Capture the single resting frame a reduced-motion user sees after the trigger. */
export async function reducedMotionEndState(args: {
  route: string;
  outDir: string;
  trigger?: Trigger;
  viewport?: Viewport;
  baseURL?: string;
  waitFor?: string;
  selector?: string;
  pauseVideo?: boolean;
  settleMs?: number;
  label?: string;
}): Promise<Frame> {
  const vp = VIEWPORTS[args.viewport ?? "mobile"];
  const baseURL = args.baseURL ?? "http://localhost:3000";
  const label = args.label ?? "anim";
  const browser = await chromium.launch();
  try {
    const context = await openContext(browser, vp, baseURL, true);
    const page = await context.newPage();
    await prep(page, { route: args.route, baseURL, waitFor: args.waitFor, pauseVideo: args.pauseVideo ?? true });

    const target = args.selector ? page.locator(args.selector).first() : page;
    await fire(page, args.trigger);
    await page.waitForTimeout(args.settleMs ?? 700);
    fs.mkdirSync(args.outDir, { recursive: true });
    const pngPath = path.join(args.outDir, `${label}.${args.viewport ?? "mobile"}.reduced.png`);
    let buf: Buffer;
    try {
      buf = await target.screenshot({ path: pngPath });
    } catch {
      buf = await page.screenshot({ path: pngPath });
    }
    return { ms: -1, base64: buf.toString("base64"), pngPath };
  } finally {
    await browser.close();
  }
}
