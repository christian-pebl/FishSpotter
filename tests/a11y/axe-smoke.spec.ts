import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const SURFACES = ["/", "/feed", "/feed/browse", "/leaderboard", "/auth/signin"] as const;

for (const path of SURFACES) {
  test(`axe-core: ${path} has no serious or critical violations`, async ({ page }) => {
    await page.goto(path);
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
