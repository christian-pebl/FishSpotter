import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const SURFACES = ["/", "/feed", "/feed/browse", "/pebbles", "/auth/signin"] as const;

// axe must check the page a visitor reads once it has settled, not a frame of
// an entrance animation. The prize card on /pebbles fades in from opacity 0,
// and while it does, its teal button (#2B7A78, 5.05:1 against white once
// settled) blends into the page. On 24 Nov 2026 that failed 3 of 8 local runs
// and every CI attempt, reading white text on backgrounds from #fbfcfc to
// #3d8583. Reduced motion turns those entrances off (the app's motion
// honours it), and `settle` waits out hydration and any finite animation that
// does not.
async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity),
  );
}

for (const path of SURFACES) {
  test(`axe-core: ${path} has no serious or critical violations`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path);
    await settle(page);
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    const moderate = results.violations.filter((v) => v.impact === "moderate");
    // Surface moderate count as test annotation; do not fail on it in Sprint 1.
    test.info().annotations.push({
      type: "axe-moderate",
      description: `${path}: ${moderate.length} moderate violations`,
    });
    expect(
      blocking,
      `axe found ${blocking.length} serious/critical violation(s) on ${path}:\n` +
        blocking.map((v) => `- ${v.id}: ${v.help}`).join("\n"),
    ).toEqual([]);
  });
}
