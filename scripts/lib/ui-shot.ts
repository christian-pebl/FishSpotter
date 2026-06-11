/**
 * Playwright capture helper for the remote build loop.
 *
 * Renders a route on the running dev server (default http://localhost:3000),
 * pauses any autoplaying video (the feed autoplays — this is why the preview
 * MCP screenshot timed out), screenshots full-page or a single element to a PNG
 * file, returns the base64 for Gemini, and optionally runs an axe-core a11y
 * scan. Used by scripts/ui-review.ts.
 *
 * Requires the chromium browser binary: `npx playwright install chromium`.
 */
import * as fs from "fs";
import * as path from "path";
import { chromium, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export type Viewport = "mobile" | "desktop";

const VIEWPORTS: Record<Viewport, { width: number; height: number; label: string }> = {
  mobile: { width: 390, height: 844, label: "mobile 390x844" },
  desktop: { width: 1280, height: 800, label: "desktop 1280x800" },
};

export type AxeViolation = { id: string; impact: string | null | undefined; help: string; nodes: number };

export type ShotResult = {
  base64: string;
  pngPath: string;
  viewportLabel: string;
  axe?: AxeViolation[];
};

/**
 * Capture a screenshot of `route`. Returns base64 + the saved PNG path.
 * `selector` clips to one element; otherwise full-page. `waitFor` waits for a
 * selector before shooting. `axe` runs an accessibility scan.
 */
export async function shoot(args: {
  route: string;
  outPath: string;
  viewport?: Viewport;
  baseURL?: string;
  waitFor?: string;
  selector?: string;
  pauseVideo?: boolean;
  axe?: boolean;
  settleMs?: number;
}): Promise<ShotResult> {
  const vp = VIEWPORTS[args.viewport ?? "mobile"];
  const baseURL = args.baseURL ?? "http://localhost:3000";
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    // Pre-set the privacy-default consent cookie so the strictly-necessary
    // cookie banner never renders over the screenshot (app-global review noise).
    await context.addCookies([
      {
        name: "pebl_consent",
        value: encodeURIComponent(JSON.stringify({ v: 1, necessary: true })),
        domain: new URL(baseURL).hostname,
        path: "/",
      },
    ]);
    const page: Page = await context.newPage();
    // Dev mode re-runs server components (no ISR cache), so a route that fetches
    // OBIS on render can take ~15s; allow generous headroom.
    await page.goto(`${baseURL}${args.route}`, { waitUntil: "networkidle", timeout: 75_000 });

    if (args.waitFor) {
      await page.waitForSelector(args.waitFor, { timeout: 15_000 }).catch(() => {});
    }
    if (args.pauseVideo) {
      await page.evaluate(() => {
        document.querySelectorAll("video").forEach((v) => {
          try { v.pause(); v.currentTime = Math.min(1, v.duration || 1); } catch { /* noop */ }
        });
      });
    }
    await page.waitForTimeout(args.settleMs ?? 600);

    let axe: AxeViolation[] | undefined;
    if (args.axe) {
      const results = await new AxeBuilder({ page }).analyze();
      axe = results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.length,
      }));
    }

    fs.mkdirSync(path.dirname(args.outPath), { recursive: true });
    const buf = args.selector
      ? await page.locator(args.selector).first().screenshot({ path: args.outPath })
      : await page.screenshot({ path: args.outPath, fullPage: true });

    return { base64: buf.toString("base64"), pngPath: args.outPath, viewportLabel: vp.label, axe };
  } finally {
    await browser.close();
  }
}

export function viewportLabel(v: Viewport): string {
  return VIEWPORTS[v].label;
}
