/**
 * @vitest-environment jsdom
 *
 * The first-render contract of the split-screen hooks (7 Sep 2026). Every one
 * of these used to be right "one effect later", which is a painted frame of
 * the wrong layout for anything mounted on a tap. See split-screen.ts.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetMediaQueryRegistry } from "./useMediaQuery";
import {
  DEFAULT_HEIGHT_PCT,
  DEFAULT_WIDTH_PCT,
  HEIGHT_STORAGE_KEY,
  MAX_WIDTH_PCT,
  WIDTH_STORAGE_KEY,
  publishPanelRect,
  publishSplitFrame,
  resetSplitSizeCache,
  useDocked,
  useSplitDocked,
  useSplitOpen,
  useStoredSplitSize,
} from "./split-screen";

function stubMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

beforeEach(() => {
  resetMediaQueryRegistry();
  resetSplitSizeCache();
  window.localStorage.clear();
  publishSplitFrame({ open: false });
  publishPanelRect(null);
});

afterEach(() => {
  resetMediaQueryRegistry();
  resetSplitSizeCache();
  // @ts-expect-error test teardown
  delete window.matchMedia;
});

describe("useDocked", () => {
  it("is true on the FIRST render of a wide viewport", () => {
    // The whole bug: a panel opened by a tap on a laptop rendered as a phone
    // sheet first because this started false and corrected itself in an effect.
    stubMatchMedia(true);
    const renders: boolean[] = [];
    renderHook(() => {
      const d = useDocked();
      renders.push(d);
      return d;
    });
    expect(renders[0]).toBe(true);
    expect(renders).not.toContain(false);
  });

  it("is false on a phone", () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => useDocked());
    expect(result.current).toBe(false);
  });
});

describe("useStoredSplitSize", () => {
  it("returns the viewer's stored size on the FIRST render", () => {
    // A stored 48% used to open at the 36% default and jump a frame later.
    window.localStorage.setItem(WIDTH_STORAGE_KEY, "48");
    window.localStorage.setItem(HEIGHT_STORAGE_KEY, "70");
    const renders: number[] = [];
    const { result } = renderHook(() => {
      const s = useStoredSplitSize();
      renders.push(s.widthPct);
      return s;
    });
    expect(renders[0]).toBe(48);
    expect(result.current.heightPct).toBe(70);
  });

  it("falls back to the defaults, clamped, when nothing is stored or it is out of range", () => {
    const { result } = renderHook(() => useStoredSplitSize());
    expect(result.current.widthPct).toBe(DEFAULT_WIDTH_PCT);
    expect(result.current.heightPct).toBe(DEFAULT_HEIGHT_PCT);

    resetSplitSizeCache();
    window.localStorage.setItem(WIDTH_STORAGE_KEY, "95");
    const { result: clamped } = renderHook(() => useStoredSplitSize());
    expect(clamped.current.widthPct).toBe(MAX_WIDTH_PCT);
  });

  it("is ONE size shared by every panel, so the width dragged on the tiles is the width the reveal opens at", () => {
    const tiles = renderHook(() => useStoredSplitSize());
    const reveal = renderHook(() => useStoredSplitSize());
    act(() => tiles.result.current.setWidthPct(44));
    expect(reveal.result.current.widthPct).toBe(44);
    // A panel mounted AFTER the drag sees it on its first render too.
    const later = renderHook(() => useStoredSplitSize());
    expect(later.result.current.widthPct).toBe(44);
  });
});

describe("the frame selectors", () => {
  it("useSplitOpen re-renders on open/close only, not on every pixel of a drag", () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useSplitOpen();
    });
    expect(result.current).toBe(false);
    act(() => publishSplitFrame({ open: true, docked: true, widthPct: 36, heightPct: 56 }));
    expect(result.current).toBe(true);
    const after = renders;
    act(() => {
      for (let w = 37; w <= 50; w += 1) {
        publishSplitFrame({ open: true, docked: true, widthPct: w, heightPct: 56 });
      }
    });
    expect(renders).toBe(after);
    act(() => publishSplitFrame({ open: false }));
    expect(result.current).toBe(false);
  });

  it("useSplitDocked is true only for an OPEN docked split", () => {
    const { result } = renderHook(() => useSplitDocked());
    expect(result.current).toBe(false);
    act(() => publishSplitFrame({ open: true, docked: false, widthPct: 36, heightPct: 56 }));
    expect(result.current).toBe(false);
    act(() => publishSplitFrame({ open: true, docked: true, widthPct: 36, heightPct: 56 }));
    expect(result.current).toBe(true);
    act(() => publishSplitFrame({ open: false, docked: true }));
    expect(result.current).toBe(false);
  });

  it("seeds a late-mounting overlay from the cached snapshot on its first render", () => {
    publishSplitFrame({ open: true, docked: true, widthPct: 36, heightPct: 56 });
    const renders: boolean[] = [];
    renderHook(() => {
      const open = useSplitOpen();
      renders.push(open);
      return open;
    });
    expect(renders[0]).toBe(true);
  });
});
