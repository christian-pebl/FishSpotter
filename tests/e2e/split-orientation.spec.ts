import { expect, test } from "@playwright/test";

/**
 * The identify panel must open in its FINAL orientation on the first frame it
 * is painted in, with the clip already resized beside (or above) it.
 *
 * On a laptop or a landscape tablet it used to open as a phone bottom sheet,
 * with the clip squashed into the top half, and flip to the docked side panel
 * two or three painted frames later, on EVERY open (measured 7 Sep 2026 at
 * 1280x800 and 1024x768: `gate-bottom=56%` for ~80ms, then `gate-left=36%`).
 * The cause was `useDocked` starting `false` and correcting itself in a mount
 * effect, so nothing that mounted on a tap ever rendered the right layout
 * first. The stored panel size had the same shape of bug.
 *
 * A settled-state assertion cannot see any of this: by the time Playwright
 * looks, the effect has already run. So the page records, once per animation
 * frame, what the split chrome and the clip frame looked like, and the test
 * asserts on the SEQUENCE: no frame in the wrong orientation, and the clip
 * inset present in the same frame the panel first appears.
 */

type Frame = {
  handle: "seam" | "grip" | "none";
  gateLeft: string;
  gateBottom: string;
  videoLeft: number;
  videoHeight: number;
};

const RECORDER = `
(() => {
  window.__fsFrames = [];
  window.__fsTracing = false;
  let last = "";
  const sample = () => {
    if (window.__fsTracing) {
      const root = document.documentElement.style;
      const seam = !!document.querySelector('[aria-label="Resize this panel"]');
      const grip = !!document.querySelector('[aria-label="Drag to resize this panel and see more of the clip"]');
      const video = document.querySelector('[data-feed-index="0"] video');
      const vr = video ? video.getBoundingClientRect() : null;
      const state = {
        handle: seam ? "seam" : grip ? "grip" : "none",
        gateLeft: root.getPropertyValue("--gate-left"),
        gateBottom: root.getPropertyValue("--gate-bottom"),
        videoLeft: vr ? Math.round(vr.left) : -1,
        videoHeight: vr ? Math.round(vr.height) : -1,
      };
      const key = JSON.stringify(state);
      if (key !== last) { last = key; window.__fsFrames.push(state); }
    }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
})();
`;

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try {
      // Skip the guest username prompt without minting a guest account, and
      // the one-time hints that would sit over the clip.
      sessionStorage.setItem("fishspotter:guestGateDismissed", "1");
      localStorage.setItem("fishspotter:tapHintSeen", "1");
      localStorage.setItem("fishspotter:navHintSeen", "1");
    } catch {}
  });
  await context.addInitScript(RECORDER);
});

test("the identify panel opens in its final orientation, clip already resized", async ({
  page,
}, testInfo) => {
  const docked = testInfo.project.name === "desktop";

  await page.goto("/feed");
  const catcher = page.locator('[data-feed-index="0"] button[aria-label="Identify this species"]');
  await catcher.waitFor({ state: "visible" });
  const viewport = page.viewportSize()!;
  await page.waitForTimeout(300);

  for (let open = 1; open <= 2; open += 1) {
    await page.evaluate(() => {
      (window as unknown as { __fsFrames: Frame[] }).__fsFrames = [];
      (window as unknown as { __fsTracing: boolean }).__fsTracing = true;
    });
    await catcher.click();
    await page.waitForTimeout(600);
    const frames = await page.evaluate(() => {
      (window as unknown as { __fsTracing: boolean }).__fsTracing = false;
      return (window as unknown as { __fsFrames: Frame[] }).__fsFrames;
    });

    const withPanel = frames.filter((f) => f.handle !== "none");
    expect(withPanel.length, `open #${open}: the panel should have been painted`).toBeGreaterThan(0);

    const wrong = withPanel.filter((f) => f.handle !== (docked ? "seam" : "grip"));
    expect(
      wrong,
      `open #${open}: no painted frame may show the ${docked ? "phone sheet" : "docked seam"}`,
    ).toEqual([]);

    // The clip gives way in the SAME frame the panel first appears, on the
    // right axis, and never on the other one.
    const first = withPanel[0];
    if (docked) {
      expect(first.gateLeft, `open #${open}: docked inset on the first panel frame`).not.toBe("");
      expect(first.gateBottom, `open #${open}: no sheet inset while docked`).toBe("");
      expect(first.videoLeft, `open #${open}: clip already pushed right`).toBeGreaterThan(0);
    } else {
      expect(first.gateBottom, `open #${open}: sheet inset on the first panel frame`).not.toBe("");
      expect(first.gateLeft, `open #${open}: no docked inset on a phone`).toBe("");
      expect(first.videoHeight, `open #${open}: clip already shortened`).toBeLessThan(
        viewport.height * 0.7,
      );
    }
    for (const f of withPanel) {
      if (docked) expect(f.gateBottom, `open #${open}: sheet inset leaked in`).toBe("");
      else expect(f.gateLeft, `open #${open}: docked inset leaked in`).toBe("");
    }

    await page.locator('button[aria-label="Close the selector"]').click();
    await page.waitForTimeout(400);
    // Closing hands the whole frame back: both insets gone, not zeroed.
    const after = await page.evaluate(() => {
      const s = document.documentElement.style;
      return [s.getPropertyValue("--gate-left"), s.getPropertyValue("--gate-bottom")];
    });
    expect(after).toEqual(["", ""]);
  }
});
