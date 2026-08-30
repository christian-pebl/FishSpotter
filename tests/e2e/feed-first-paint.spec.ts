import { expect, test } from "@playwright/test";

/**
 * The feed must open on the clip, never on the working half of the split.
 *
 * `FeedCard`'s identify panel used to initialise EXPANDED and be collapsed by a
 * mount effect, so the server sent one open, empty panel per card (139 of them)
 * and the first paint of every visit was a half-height blank sheet with the
 * clip letterboxed into the half above it, before it snapped to full bleed.
 *
 * This asserts on the SERVER HTML rather than on the settled page, and that is
 * the whole point: by the time the DOM has hydrated the effect has already
 * corrected it, so a normal `page.goto` assertion passed throughout the bug's
 * life. `request.get` runs no JavaScript, so it sees exactly the frame the
 * viewer saw.
 */
test("the feed's first paint is the clip, not an empty split panel", async ({ request }) => {
  const res = await request.get("/feed");
  expect(res.status(), "/feed should return 2xx").toBeLessThan(400);
  const html = await res.text();

  // A card opens on its collapsed identify bar.
  expect(html, "the collapsed identify bar should be in the first paint").toContain(
    "Tap to name species",
  );

  // None of the split chrome (SplitPanel or TileGate) may be, on either axis.
  // Both resize handles are checked because the axis is viewport-dependent and
  // the server does not know the viewport: a sheet on a phone, a docked seam on
  // a desktop, and a regression could reintroduce either.
  expect(html, "no sheet grip should be in the first paint").not.toContain(
    "Drag to resize this panel",
  );
  expect(html, "no docked resize seam should be in the first paint").not.toContain(
    'aria-label="Resize this panel"',
  );
  expect(html, "no split panel dialog should be in the first paint").not.toContain(
    'aria-modal="false"',
  );
});
