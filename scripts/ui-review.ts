/**
 * UI visual-review loop primitive: screenshot a route (mobile + desktop) on the
 * running dev server, run an axe-core a11y scan, and get a Gemini visual
 * critique against a brief + the PEBL design system. Prints a structured report
 * and saves the PNGs. The build loop is: edit -> ui-review -> fix high-severity
 * issues + brand/axe violations -> repeat until verdict=pass.
 *
 * Behaviour (scoring/routing/unlock) is NOT judged here — that stays on
 * Playwright assertions + vitest. Gemini judges look only; advisory.
 *
 * Needs the dev server running (preview) + `npx playwright install chromium` +
 * GEMINI_API_KEY in .env.local.
 *
 *   npx tsx --env-file=.env.local scripts/ui-review.ts \
 *     --route /leaderboard --brief "Community leaderboard ..." [--viewport mobile|desktop|both] \
 *     [--wait "h1"] [--selector ".card"] [--no-pause-video] [--json]
 */
import { shoot, type Viewport } from "./lib/ui-shot";
import { critiqueUi } from "@/lib/ui-critique";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

async function reviewOne(route: string, brief: string, vp: Viewport, opts: {
  baseURL?: string; waitFor?: string; selector?: string; pauseVideo: boolean; json: boolean;
}) {
  const stamp = route.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root";
  const outPath = `implementation/2026-06-10/shots/${stamp}.${vp}.png`;
  const shot = await shoot({
    route, outPath, viewport: vp,
    baseURL: opts.baseURL, waitFor: opts.waitFor, selector: opts.selector,
    pauseVideo: opts.pauseVideo, axe: true,
  });
  const res = await critiqueUi({
    imageBase64: shot.base64, mimeType: "image/png", brief, viewport: shot.viewportLabel,
  });

  if (opts.json) {
    console.log(JSON.stringify({ route, viewport: vp, png: shot.pngPath, axe: shot.axe, critique: res }, null, 2));
    return res.ok ? res.critique.verdict : "error";
  }

  console.log(`\n=== ${route}  [${shot.viewportLabel}]  -> ${shot.pngPath} ===`);
  const axe = shot.axe ?? [];
  console.log(`axe: ${axe.length} violation(s)${axe.length ? ": " + axe.map((v) => `${v.id}(${v.impact},${v.nodes})`).join(", ") : ""}`);
  if (!res.ok) {
    console.log(`GEMINI ERROR: ${res.error}`);
    return "error";
  }
  const c = res.critique;
  console.log(`verdict: ${c.verdict.toUpperCase()}  score ${c.score}  readability ${c.readability}  matchesIntent ${c.matchesIntent}`);
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
    console.error('Usage: --route /path --brief "what this screen should be" [--viewport mobile|desktop|both]');
    process.exit(1);
  }
  const vpArg = (arg("viewport") ?? "both") as Viewport | "both";
  const viewports: Viewport[] = vpArg === "both" ? ["mobile", "desktop"] : [vpArg];
  const opts = {
    baseURL: arg("baseURL"),
    waitFor: arg("wait"),
    selector: arg("selector"),
    pauseVideo: !has("no-pause-video"),
    json: has("json"),
  };

  const verdicts: string[] = [];
  for (const vp of viewports) {
    verdicts.push(await reviewOne(route, brief, vp, opts));
  }
  const pass = verdicts.every((v) => v === "pass");
  if (!opts.json) console.log(`\nOVERALL: ${pass ? "PASS" : "REVISE"} (${verdicts.join(", ")})`);
  process.exit(pass ? 0 : 0); // always 0; this is advisory, not a CI gate
}

main().catch((e) => { console.error(e); process.exit(1); });
