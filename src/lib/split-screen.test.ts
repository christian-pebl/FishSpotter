/**
 * @vitest-environment jsdom
 *
 * `src/lib/**` defaults to the node environment (see vitest.config.ts), but this
 * module talks to `window` and `document.documentElement.style`, so it needs a
 * DOM. Overridden per-file rather than by widening the config glob, which would
 * pull every other pure-logic lib test onto the slower jsdom environment.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_HEIGHT_PCT,
  MAX_WIDTH_PCT,
  MIN_HEIGHT_PCT,
  MIN_WIDTH_PCT,
  clampHeightPct,
  clampWidthPct,
  getSplitFrame,
  publishPanelRect,
  publishSplitFrame,
  subscribeSplitFrame,
} from "./split-screen";

const PANEL_VARS = ["--fs-panel-x", "--fs-panel-y", "--fs-panel-w", "--fs-panel-h"];

const fakePanel = (rect: Partial<DOMRect>) => {
  const el = document.createElement("div");
  el.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 0, height: 0, ...rect }) as DOMRect;
  return el;
};

beforeEach(() => {
  publishSplitFrame({ open: false });
  publishPanelRect(null);
});

describe("clamps", () => {
  it("keeps the panel between its bounds on both axes", () => {
    expect(clampWidthPct(0)).toBe(MIN_WIDTH_PCT);
    expect(clampWidthPct(999)).toBe(MAX_WIDTH_PCT);
    expect(clampWidthPct(36)).toBe(36);
    expect(clampHeightPct(0)).toBe(MIN_HEIGHT_PCT);
    expect(clampHeightPct(999)).toBe(MAX_HEIGHT_PCT);
    expect(clampHeightPct(50)).toBe(50);
  });

  it("never lets the panel take more than half the clip", () => {
    // The load-bearing guarantee of the split: raising MAX_WIDTH_PCT past 50
    // means the working half is bigger than the clip half, which defeats it.
    expect(MAX_WIDTH_PCT).toBeLessThanOrEqual(50);
  });
});

describe("the frame snapshot", () => {
  it("is readable straight after publishing, without waiting for an event", () => {
    // An overlay that mounts INTO an already-open split (a comparison opened
    // from the tiles) has no event to wait for. If the snapshot were not
    // cached it would render full screen for its whole life.
    publishSplitFrame({ open: true, docked: true, widthPct: 42, heightPct: 50 });
    expect(getSplitFrame()).toEqual({
      open: true,
      docked: true,
      widthPct: 42,
      heightPct: 50,
    });
  });

  it("normalises any closed frame to a bare closed snapshot", () => {
    publishSplitFrame({ open: true, docked: false, widthPct: 36, heightPct: 80 });
    publishSplitFrame({ open: false, docked: false, widthPct: 36, heightPct: 80 });
    expect(getSplitFrame()).toEqual({ open: false });
  });

  it("notifies subscribers and stops on unsubscribe", () => {
    const seen: boolean[] = [];
    const off = subscribeSplitFrame((f) => seen.push(f.open));
    publishSplitFrame({ open: true, docked: true, widthPct: 36, heightPct: 50 });
    publishSplitFrame({ open: false });
    off();
    publishSplitFrame({ open: true, docked: true, widthPct: 36, heightPct: 50 });
    expect(seen).toEqual([true, false]);
  });
});

describe("the panel rect custom properties", () => {
  it("mirrors the panel's viewport rect", () => {
    publishPanelRect(fakePanel({ left: 0, top: 56, width: 518, height: 844 }));
    const root = document.documentElement.style;
    expect(root.getPropertyValue("--fs-panel-x")).toBe("0px");
    expect(root.getPropertyValue("--fs-panel-y")).toBe("56px");
    expect(root.getPropertyValue("--fs-panel-w")).toBe("518px");
    expect(root.getPropertyValue("--fs-panel-h")).toBe("844px");
  });

  it("REMOVES the properties when there is no panel, rather than zeroing them", () => {
    // Overlays fall back to full screen via `var(--fs-panel-w, 100vw)`. A "0px"
    // value satisfies the var and would collapse every overlay to nothing
    // instead, so clearing has to unset, not zero.
    publishPanelRect(fakePanel({ left: 0, top: 56, width: 518, height: 844 }));
    publishPanelRect(null);
    for (const v of PANEL_VARS) {
      expect(document.documentElement.style.getPropertyValue(v)).toBe("");
    }
  });

  it("treats a collapsed panel as no panel", () => {
    // Mid-exit-animation a panel can measure 0x0. Publishing that would pin
    // every overlay to a zero-size box in the corner.
    publishPanelRect(fakePanel({ left: 0, top: 56, width: 518, height: 844 }));
    publishPanelRect(fakePanel({ left: 0, top: 0, width: 0, height: 0 }));
    for (const v of PANEL_VARS) {
      expect(document.documentElement.style.getPropertyValue(v)).toBe("");
    }
  });

  it("rounds to whole pixels so a resize drag does not churn the property", () => {
    const spy = vi.spyOn(document.documentElement.style, "setProperty");
    publishPanelRect(fakePanel({ left: 0.4, top: 55.6, width: 517.8, height: 843.2 }));
    expect(spy).toHaveBeenCalledWith("--fs-panel-x", "0px");
    expect(spy).toHaveBeenCalledWith("--fs-panel-y", "56px");
    expect(spy).toHaveBeenCalledWith("--fs-panel-w", "518px");
    expect(spy).toHaveBeenCalledWith("--fs-panel-h", "843px");
    spy.mockRestore();
  });
});
