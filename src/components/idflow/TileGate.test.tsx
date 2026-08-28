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
 * The photo tile's interaction contract (28 Aug 2026).
 *
 * A Rung-3 tile now does two different jobs with one card: the picture flicks
 * between that species' reference shots so you can compare them against the
 * clip still playing beside it, and the name row underneath is what selects.
 * Every case below is one of the ways that split can silently break, and each
 * one is a dead or wrong tap for a user rather than a crash, so nothing else
 * would catch it:
 *
 *  - a flick that also fires onSelect commits a guess the user never made,
 *  - a flick that does not change the photo is a tap that does nothing,
 *  - a single-photo tile whose picture stops selecting is a dead half-tile,
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

/** The tile card: the picture box plus the name row. */
function tileCard(label: string) {
  const name = screen.getByRole("button", { name: `Pick ${label}` });
  const card = name.parentElement;
  if (!card) throw new Error("tile card not found");
  return card as HTMLElement;
}

const shownPhoto = (label: string) =>
  (tileCard(label).querySelector("img") as HTMLImageElement | null)?.getAttribute("src");

/** The two flick halves are aria-hidden pointer conveniences (the keyboard
 *  route is on the name row), so they are addressed positionally. */
function halves(label: string) {
  const box = tileCard(label).firstElementChild as HTMLElement;
  const zones = Array.from(box.querySelectorAll('button[aria-hidden="true"]'));
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

  it("flicks with the arrow keys from the name row", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderGate([photoTile()]);
    const name = screen.getByRole("button", { name: "Pick Lesser-spotted catshark" });
    name.focus();

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

  it("selects from the name row", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderGate([photoTile()]);
    await user.click(screen.getByRole("button", { name: "Pick Lesser-spotted catshark" }));
    // The tile plays a short lock-in before it reports the pick.
    await vi.waitFor(() => expect(onSelect).toHaveBeenCalledWith("Scyliorhinus canicula"));
  });

  it("keeps the picture as a select target when there is nothing to flick to", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderGate([photoTile({ photos: ["/only.jpg"] })]);
    const box = tileCard("Lesser-spotted catshark").firstElementChild as HTMLElement;
    // No halves, no dots: there is only one photo.
    expect(box.querySelectorAll('button[aria-hidden="true"]')).toHaveLength(1);

    await user.click(box.querySelector('button[aria-hidden="true"]') as HTMLElement);
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
