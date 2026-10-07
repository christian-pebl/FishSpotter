import { describe, expect, it } from "vitest";
import {
  WATCH_CAP_PER_CLIP_SECONDS,
  WATCH_IDLE_AFTER_MS,
  WATCH_MAX_SEGMENT_SECONDS,
  cappedWatchSeconds,
  countableWatchSeconds,
  isWatchIdle,
  type WatchRow,
} from "./watch-time";

const T0 = Date.UTC(2026, 9, 7, 12, 0, 0);
const s = (n: number) => n * 1000;

describe("countableWatchSeconds", () => {
  it("counts an ordinary 25-second segment in full", () => {
    expect(countableWatchSeconds(T0, T0 + s(25), T0)).toBe(25);
  });

  it("stops counting two minutes after the last input", () => {
    // Segment from 1:40 to 2:05 after the last tap: only the 20 s up to the
    // two-minute cut-off count.
    const lastInput = T0;
    const start = T0 + s(100);
    expect(countableWatchSeconds(start, T0 + s(125), lastInput)).toBe(20);
  });

  it("banks nothing for a segment that starts after the viewer went quiet", () => {
    expect(countableWatchSeconds(T0 + WATCH_IDLE_AFTER_MS + s(5), T0 + WATCH_IDLE_AFTER_MS + s(30), T0)).toBe(0);
  });

  it("never banks more than one segment's worth, so a slept laptop cannot bank the night", () => {
    // Input just before waking, segment started eight hours ago.
    const now = T0 + 8 * 60 * 60 * 1000;
    expect(countableWatchSeconds(T0, now, now - s(1))).toBe(WATCH_MAX_SEGMENT_SECONDS);
  });

  it("treats a clock that ran backwards as zero, not negative", () => {
    expect(countableWatchSeconds(T0 + s(10), T0, T0)).toBe(0);
  });
});

describe("isWatchIdle", () => {
  it("is idle only after the cut-off has passed", () => {
    expect(isWatchIdle(T0 + WATCH_IDLE_AFTER_MS, T0)).toBe(false);
    expect(isWatchIdle(T0 + WATCH_IDLE_AFTER_MS + 1, T0)).toBe(true);
  });
});

function row(at: number, value: number | null, sessionId = "tab1", snippetId: string | null = "clipA"): WatchRow {
  return { createdAt: new Date(at), value, sessionId, snippetId };
}

describe("cappedWatchSeconds", () => {
  it("leaves ordinary viewing untouched", () => {
    const rows = [row(T0, 25), row(T0 + s(25), 25), row(T0 + s(50), 12)];
    expect(cappedWatchSeconds(rows)).toEqual([25, 25, 12]);
  });

  it("caps a tab left looping one clip at five minutes", () => {
    // The 28 to 29 Aug shape: a 25-second row every 25 seconds for hours.
    const rows = Array.from({ length: 2482 }, (_, i) => row(T0 + s(25 * i), 25));
    const total = cappedWatchSeconds(rows).reduce((a, b) => a + b, 0);
    expect(total).toBe(WATCH_CAP_PER_CLIP_SECONDS);
  });

  it("counts the first five minutes in logged order, splitting the row that crosses the cap", () => {
    const rows = [row(T0, 200), row(T0 + s(200), 200), row(T0 + s(400), 200)];
    expect(cappedWatchSeconds(rows)).toEqual([200, 100, 0]);
  });

  it("caps each tab and clip pair on its own", () => {
    const rows = [
      row(T0, 290, "tab1", "clipA"),
      row(T0 + s(1), 290, "tab1", "clipB"),
      row(T0 + s(2), 290, "tab2", "clipA"),
      row(T0 + s(3), 50, "tab1", "clipA"),
    ];
    expect(cappedWatchSeconds(rows)).toEqual([290, 290, 290, 10]);
  });

  it("returns values aligned to the input order even when rows arrive unsorted", () => {
    const rows = [row(T0 + s(400), 200), row(T0, 200), row(T0 + s(200), 200)];
    expect(cappedWatchSeconds(rows)).toEqual([0, 200, 100]);
  });

  it("treats null and negative values as zero", () => {
    expect(cappedWatchSeconds([row(T0, null), row(T0 + 1, -5), row(T0 + 2, 10)])).toEqual([0, 0, 10]);
  });
});
