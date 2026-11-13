// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FIRST_PAINT_FALLBACK_MS,
  resetFirstPaintForTests,
  useAfterFirstPaint,
} from "./useAfterFirstPaint";

type PaintCallback = (list: { getEntries: () => { name: string }[] }) => void;

let paintCallbacks: PaintCallback[] = [];
let alreadyPainted = false;

class FakePaintObserver {
  constructor(private readonly callback: PaintCallback) {}
  observe() {
    paintCallbacks.push(this.callback);
  }
  disconnect() {
    paintCallbacks = paintCallbacks.filter((c) => c !== this.callback);
  }
}

function firePaint(name = "first-contentful-paint") {
  for (const callback of [...paintCallbacks]) callback({ getEntries: () => [{ name }] });
}

beforeEach(() => {
  vi.useFakeTimers();
  resetFirstPaintForTests();
  paintCallbacks = [];
  alreadyPainted = false;
  vi.stubGlobal("PerformanceObserver", FakePaintObserver);
  vi.spyOn(performance, "getEntriesByName").mockImplementation(() =>
    alreadyPainted ? ([{ name: "first-contentful-paint" }] as unknown as PerformanceEntryList) : [],
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useAfterFirstPaint", () => {
  it("is false until the browser reports the first contentful paint", () => {
    const { result } = renderHook(() => useAfterFirstPaint());
    expect(result.current).toBe(false);

    // `first-paint` alone (a background colour) is not content.
    act(() => firePaint("first-paint"));
    expect(result.current).toBe(false);

    act(() => firePaint());
    expect(result.current).toBe(true);
  });

  it("is true straight away when the page painted before the component mounted", () => {
    alreadyPainted = true;
    const { result } = renderHook(() => useAfterFirstPaint());
    expect(result.current).toBe(true);
  });

  it("falls through on a timer when no paint is ever reported", () => {
    const { result } = renderHook(() => useAfterFirstPaint());
    act(() => vi.advanceTimersByTime(FIRST_PAINT_FALLBACK_MS - 1));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  it("still resolves in a browser with no Paint Timing at all", () => {
    vi.stubGlobal("PerformanceObserver", undefined);
    const { result } = renderHook(() => useAfterFirstPaint());
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(FIRST_PAINT_FALLBACK_MS));
    expect(result.current).toBe(true);
  });

  it("shares one signal between every component that asks", () => {
    const first = renderHook(() => useAfterFirstPaint());
    const second = renderHook(() => useAfterFirstPaint());
    expect(paintCallbacks).toHaveLength(1);
    act(() => firePaint());
    expect(first.result.current).toBe(true);
    expect(second.result.current).toBe(true);
  });
});
