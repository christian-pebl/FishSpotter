/**
 * MOTION-review loop: trigger an animation on the running dev server, capture a
 * filmstrip across its timeline + a reduced-motion resting frame, and get a
 * Gemini critique of the ARC against the house aesthetic (subtle, smooth, lands
 * on a clear end state, on-brand, reduced-motion still informative). Prints a
 * structured report and saves the PNGs. Advisory, not a CI gate.
 *
 * The build loop is: build the animation -> motion-review -> fix high issues +
 * brand breaches -> repeat until verdict=pass. It is the motion counterpart of
 * scripts/ui-review.ts (which judges a single settled frame and is blind to
 * motion).
 *
 * Needs: dev server running (npm run dev), `npx playwright install chromium`,
 * and GEMINI_API_KEY in .env.local (free tier ~20 req/day — this spends ONE call
 * per run, both viewports share nothing, so a two-viewport run is two calls).
 *
 *   npx tsx --env-file=.env.local scripts/motion-review.ts \
 *     --route /feed --brief "Tile lock-in: tap a shape tile, it presses in and
 *       confirms teal, ~180ms, then proceeds. Must be tiny and not distract." \
 *     --click "button[aria-label^='Fish']" --selector "[role=dialog]" \
 *     --frames "0,90,180,320" [--viewport mobile|desktop|both] [--no-reduced] [--json]
 */
import { filmstrip, reducedMotionEndState, type Viewport } from "./lib/motion-shot";
import { critiqueMotion } from "@/lib/motion-critique";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

const OUT_DIR = "implementation/2026-06-11/motion-shots";

async function reviewOne(
  route: string,
  brief: string,
  vp: Viewport,
  opts: {
    trigger: { click?: string; eval?: string };
    frames: number[];
    baseURL?: string;
    waitFor?: string;
    selector?: string;
    pauseVideo: boolean;
    reduced: boolean;
    json: boolean;
  },
) {
  const stamp = route.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root";
  const label = `${stamp}.${(arg("label") ?? "anim")}`;
  const strip = await filmstrip({
    route, outDir: OUT_DIR, frames: opts.frames, trigger: opts.trigger, viewport: vp,
    baseURL: opts.baseURL, waitFor: opts.waitFor, selector: opts.selector,
    pauseVideo: opts.pauseVideo, label,
  });
  const reducedFrame = opts.reduced
    ? await reducedMotionEndState({
        route, outDir: OUT_DIR, trigger: opts.trigger, viewport: vp,
        baseURL: opts.baseURL, waitFor: opts.waitFor, selector: opts.selector,
        pauseVideo: opts.pauseVideo, label,
      })
    : null;

  const res = await critiqueMotion({
    frames: strip.frames.map((f) => ({ ms: f.ms, base64: f.base64 })),
    reducedMotionFrame: reducedFrame ? { base64: reducedFrame.base64 } : null,
    brief,
    viewport: strip.viewportLabel,
  });

  if (opts.json) {
    console.log(JSON.stringify({
      route, viewport: vp,
      frames: strip.frames.map((f) => ({ ms: f.ms, png: f.pngPath })),
      reduced: reducedFrame?.pngPath ?? null,
      critique: res,
    }, null, 2));
    return res.ok ? res.critique.verdict : "error";
  }

  console.log(`\n=== ${route}  [${strip.viewportLabel}]  ${strip.frames.length} frames -> ${OUT_DIR} ===`);
  if (!res.ok) {
    console.log(`GEMINI ERROR: ${res.error}`);
    return "error";
  }
  const c = res.critique;
  console.log(`verdict: ${c.verdict.toUpperCase()}  score ${c.score}  smoothness ${c.smoothness}  subtlety ${c.subtlety}`);
  console.log(`landsOnEndState ${c.landsOnEndState}  onBrand ${c.onBrand}  amplitudeOk ${c.amplitudeOk}  reducedMotionInformative ${c.reducedMotionInformative}`);
  if (c.brandViolations.length) console.log(`brand: ${c.brandViolations.join("; ")}`);
  for (const i of c.issues) console.log(`  [${i.severity}] ${i.area}: ${i.detail}  -> ${i.fix}`);
  console.log(`note: ${c.notes}`);
  console.log(`(gemini ${res.usage.total} tok)`);
  return c.verdict;
}

async function main() {
  const route = arg("route");
  const brief = arg("brief");
  if (!route || !brief) {
    console.error('Usage: --route /path --brief "what this animation should feel like" [--click <sel>] [--eval <js>] [--selector <clip>] [--frames "0,90,180,320"] [--viewport mobile|desktop|both] [--no-reduced]');
    process.exit(1);
  }
  const vpArg = (arg("viewport") ?? "mobile") as Viewport | "both";
  const viewports: Viewport[] = vpArg === "both" ? ["mobile", "desktop"] : [vpArg];
  const frames = (arg("frames") ?? "0,100,250,450,700,1000")
    .split(",").map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n));
  const opts = {
    trigger: { click: arg("click"), eval: arg("eval") },
    frames,
    baseURL: arg("baseURL"),
    waitFor: arg("wait"),
    selector: arg("selector"),
    pauseVideo: !has("no-pause-video"),
    reduced: !has("no-reduced"),
    json: has("json"),
  };

  const verdicts: string[] = [];
  for (const vp of viewports) {
    verdicts.push(await reviewOne(route, brief, vp, opts));
  }
  const pass = verdicts.every((v) => v === "pass");
  if (!opts.json) console.log(`\nOVERALL: ${pass ? "PASS" : "REVISE"} (${verdicts.join(", ")})`);
  process.exit(0); // advisory, never a CI gate
}

main().catch((e) => { console.error(e); process.exit(1); });
