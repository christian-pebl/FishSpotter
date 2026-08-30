import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TileGate, type TileSpec } from "./TileGate";

// jsdom ships no matchMedia, and TileGate asks it whether to dock the panel on
// mount. Answering "no" puts every test on the phone sheet, which is the
// surface these taps are really about.
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });

  // jsdom also ships no ResizeObserver, and split-screen.ts's useSplitPanel
  // (mounted whenever a tile's split panel is open) constructs one to keep the
  // panel rect in step. The tests here never assert on that rect, they just
  // need the mount not to throw.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

/**
 * The photo tile's interaction contract (28 Aug 2026, revised 30 Aug 2026).
 *
 * A Rung-3 tile does two different jobs with one card. The MIDDLE of the
 * picture selects the species, and the outer 30% either side flicks between
 * that species' reference shots so you can compare them against the clip still
 * playing beside it. The name underneath is a plain label.
 *
 * The middle used to be a flick half and the name row used to be the select,
 * which meant the obvious thing to tap, the animal, was the one thing that did
 * not choose it.
 *
 * Every case below is one of the ways that split can silently break, and each
 * is a dead or wrong tap for a user rather than a crash, so nothing else would
 * catch it:
 *
 *  - a flick that also fires onSelect commits a guess the user never made,
 *  - a flick that does not change the photo is a tap that does nothing,
 *  - a middle that stops selecting puts the pick back where nobody aims,
 *  - a single-photo tile whose picture stops selecting is a dead tile,
 *  - a second control per tile doubles every keyboard user's tab count,
 *  - a silhouette rung that picks up the split loses its one big tap target.
 */

const PHOTOS = ["/a.jpg", "/b.jpg", "/c.jpg"];

function photoTile(over: Partial<TileSpec> = {}): TileSpec {
  return {
    key: "Scyliorhinus canicula",
    label: "Lesser-spotted catshark",
    ariaLabel: "Pick Lesser-spotted catshark",
    photos: PHOTOS,
    ...over,
  };
}

function renderGate(tiles: TileSpec[], props: Partial<Parameters<typeof TileGate>[0]> = {}) {
  const onSelect = vi.fn();
  const onClose = vi.fn();
  render(
    <TileGate
      ariaLabel="Which species is it?"
      title="Which one is it?"
      tiles={tiles}
      columns={2}
      onSelect={onSelect}
      onClose={onClose}
      {...props}
    />,
  );
  return { onSelect, onClose };
}

/** The one control on a photo tile: the middle of the picture. */
const selectZone = (label: string) =>
  screen.getByRole("button", { name: `Pick ${label}` });

/** The tile card: the picture box plus the name label. The select control lives
 *  INSIDE the picture box, so the card is two levels up from it. */
function tileCard(label: string) {
  const card = selectZone(label).parentElement?.parentElement;
  if (!card) throw new Error("tile card not found");
  return card as HTMLElement;
}

const pictureBox = (label: string) =>
  tileCard(label).firstElementChild as HTMLElement;

const shownPhoto = (label: string) =>
  (tileCard(label).querySelector("img") as HTMLImageElement | null)?.getAttribute("src");

/** The two flick edges are aria-hidden pointer conveniences (the keyboard route
 *  is Left/Right on the select control), so they are addressed positionally. */
function halves(label: string) {
  const zones = Array.from(
    pictureBox(label).querySelectorAll('button[aria-hidden="true"]'),
  );
  return { prev: zones[0] as HTMLElement, next: zones[1] as HTMLElement };
}

describe("TileGate photo tiles", () => {
  it("flicks forward through the reference photos without selecting", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderGate([photoTile()]);
    expect(shownPhoto("Lesser-spotted catshark")).toBe("/a.jpg");

    await user.click(halves("Lesser-spotted catshark").next);
    expect(shownPhoto("Lesser-spotted catshark")).toBe("/b.jpg");
    await user.click(halves("Lesser-spotted catshark").next);
    expect(shownPhoto("Lesser-spotted catshark")).toBe("/c.jpg");

    // Looking is not choosing.
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("wraps at both ends so no tap is ever a dead end", async () => {
    const user = userEvent.setup();
    renderGate([photoTile()]);

    // Back from the first photo lands on the last.
    await user.click(halves("Lesser-spotted catshark").prev);
    expect(shownPhoto("Lesser-spotted catshark")).toBe("/c.jpg");
    // Forward from the last lands on the first.
    await user.click(halves("Lesser-spotted catshark").next);
    expect(shownPhoto("Lesser-spotted catshark")).toBe("/a.jpg");
  });

  it("flicks with the arrow keys from the select control", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderGate([photoTile()]);
    selectZone("Lesser-spotted catshark").focus();

    await user.keyboard("{ArrowRight}");
    expect(shownPhoto("Lesser-spotted catshark")).toBe("/b.jpg");
    await user.keyboard("{ArrowLeft}");
    expect(shownPhoto("Lesser-spotted catshark")).toBe("/a.jpg");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("announces the flick, which is silent to a screen reader otherwise", async () => {
    const user = userEvent.setup();
    renderGate([photoTile()]);
    await user.click(halves("Lesser-spotted catshark").next);
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toMatch(
      /photo 2 of 3/i,
    );
  });

  it("selects from the middle of the picture, not from the flick edges", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderGate([photoTile()]);
    const middle = selectZone("Lesser-spotted catshark");
    const { prev, next } = halves("Lesser-spotted catshark");

    // Three separate zones. If the select ever collapses back onto an edge, a
    // flick starts committing guesses the user never made.
    expect(middle).not.toBe(prev);
    expect(middle).not.toBe(next);
    // ...and it is inside the picture, not a row beneath it.
    expect(pictureBox("Lesser-spotted catshark").contains(middle)).toBe(true);

    await user.click(middle);
    // The tile plays a short lock-in before it reports the pick.
    await vi.waitFor(() => expect(onSelect).toHaveBeenCalledWith("Scyliorhinus canicula"));
  });

  it("gives a photo tile exactly one control, so the name is a label", () => {
    renderGate([photoTile()]);
    // The name row used to be a second button carrying the same action, i.e.
    // two tab stops per species across a 24-tile grid, and a 44px row under
    // every tile that a phone sheet cannot spare.
    const named = within(tileCard("Lesser-spotted catshark"))
      .queryAllByRole("button")
      .filter((b) => !b.hasAttribute("aria-hidden"));
    expect(named).toHaveLength(1);
    expect(named[0]).toBe(selectZone("Lesser-spotted catshark"));
  });

  it("keeps the whole picture selecting when there is nothing to flick to", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderGate([photoTile({ photos: ["/only.jpg"] })]);
    // No edges, no dots: one photo has nothing to flick to, so the select
    // stretches over the whole picture rather than leaving two dead strips.
    expect(
      pictureBox("Lesser-spotted catshark").querySelectorAll('button[aria-hidden="true"]'),
    ).toHaveLength(0);

    await user.click(selectZone("Lesser-spotted catshark"));
    await vi.waitFor(() => expect(onSelect).toHaveBeenCalledWith("Scyliorhinus canicula"));
  });

  it("rules a species out from the corner without selecting it", async () => {
    const user = userEvent.setup();
    const onRuleOut = vi.fn();
    const { onSelect } = renderGate([photoTile()], { onRuleOut });

    await user.click(screen.getByRole("button", { name: "Rule out Lesser-spotted catshark" }));
    expect(onRuleOut).toHaveBeenCalledWith("Scyliorhinus canicula");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("leaves silhouette rungs as a single button per tile", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderGate(
      [{ key: "fish", label: "Fish", ariaLabel: "Fish", icon: <svg /> }],
      { onRuleOut: vi.fn() },
    );
    const tile = screen.getByRole("button", { name: "Fish" });
    // The whole tile is the target on the shape rungs: a picture-plus-name-row
    // split there would shrink it to the label strip.
    expect(within(tile).queryAllByRole("button")).toHaveLength(0);

    await user.click(tile);
    await vi.waitFor(() => expect(onSelect).toHaveBeenCalledWith("fish"));
  });
});
