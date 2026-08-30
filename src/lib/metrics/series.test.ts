import { describe, expect, it } from "vitest";
import {
  buildDailyCounts,
  buildMetricSeries,
  distinctActiveSpotters,
  ratioSeries,
  rollingAverage,
  sum,
  type EventRow,
  type SeriesInput,
} from "./series";

const DAYS = ["2026-08-01", "2026-08-02", "2026-08-03"];

function at(day: string, time = "10:00:00"): Date {
  return new Date(`${day}T${time}Z`);
}

function input(partial: Partial<SeriesInput> = {}): SeriesInput {
  return { users: [], events: [], answers: [], unlocks: [], usersBefore: 0, ...partial };
}

describe("buildDailyCounts", () => {
  it("buckets each row into its UTC day", () => {
    const counts = buildDailyCounts(
      DAYS,
      input({
        users: [
          { createdAt: at("2026-08-01", "00:00:00") },
          { createdAt: at("2026-08-01", "23:59:59") },
          { createdAt: at("2026-08-03") },
        ],
      }),
    );
    expect(counts.newSpotters).toEqual([2, 0, 1]);
  });

  it("ignores rows outside the day list instead of folding them onto an edge", () => {
    // A row that leaks in from a wider query must not inflate the first or last
    // day, where it would look like a real spike.
    const counts = buildDailyCounts(
      DAYS,
      input({ users: [{ createdAt: at("2026-07-31") }, { createdAt: at("2026-08-04") }] }),
    );
    expect(counts.newSpotters).toEqual([0, 0, 0]);
  });

  it("counts a spotter once a day however many sessions they start", () => {
    const events: EventRow[] = [
      { createdAt: at("2026-08-01", "08:00:00"), type: "session_start", value: null, userId: "u1" },
      { createdAt: at("2026-08-01", "12:00:00"), type: "session_start", value: null, userId: "u1" },
      { createdAt: at("2026-08-01", "18:00:00"), type: "session_start", value: null, userId: "u2" },
      { createdAt: at("2026-08-02"), type: "session_start", value: null, userId: "u1" },
    ];
    const counts = buildDailyCounts(DAYS, input({ events }));
    expect(counts.sessions).toEqual([3, 1, 0]);
    expect(counts.activeSpotters).toEqual([2, 1, 0]);
  });

  it("leaves signed-out sessions out of the active-spotter count but in the session count", () => {
    const events: EventRow[] = [
      { createdAt: at("2026-08-01"), type: "session_start", value: null, userId: null },
      { createdAt: at("2026-08-01"), type: "session_start", value: null, userId: "u1" },
    ];
    const counts = buildDailyCounts(DAYS, input({ events }));
    expect(counts.sessions[0]).toBe(2);
    expect(counts.activeSpotters[0]).toBe(1);
  });

  it("sums watch seconds and treats a missing value as zero", () => {
    const events: EventRow[] = [
      { createdAt: at("2026-08-02"), type: "clip_watch", value: 30, userId: "u1" },
      { createdAt: at("2026-08-02"), type: "clip_watch", value: 12.5, userId: "u1" },
      { createdAt: at("2026-08-02"), type: "clip_watch", value: null, userId: "u1" },
    ];
    expect(buildDailyCounts(DAYS, input({ events })).watchSeconds).toEqual([0, 42.5, 0]);
  });

  it("counts clip views separately from watch time", () => {
    const events: EventRow[] = [
      { createdAt: at("2026-08-01"), type: "clip_view", value: null, userId: "u1" },
      { createdAt: at("2026-08-01"), type: "clip_view", value: null, userId: "u2" },
      { createdAt: at("2026-08-01"), type: "cta_click", value: null, userId: "u2" },
    ];
    const counts = buildDailyCounts(DAYS, input({ events }));
    expect(counts.clipViews).toEqual([2, 0, 0]);
    expect(counts.watchSeconds).toEqual([0, 0, 0]);
  });

  it("keeps an unsettled ID out of both halves of accuracy", () => {
    // isCorrect stays null until the consensus cron settles the clip. Counting
    // it as wrong would report a fall in accuracy that is really a lag.
    const counts = buildDailyCounts(
      DAYS,
      input({
        answers: [
          { createdAt: at("2026-08-01"), isCorrect: true },
          { createdAt: at("2026-08-01"), isCorrect: false },
          { createdAt: at("2026-08-01"), isCorrect: null },
        ],
      }),
    );
    expect(counts.identifications).toEqual([3, 0, 0]);
    expect(counts.settledIds).toEqual([2, 0, 0]);
    expect(counts.matchedIds).toEqual([1, 0, 0]);
  });

  it("buckets species unlocks on firstUnlockedAt", () => {
    const counts = buildDailyCounts(
      DAYS,
      input({ unlocks: [{ firstUnlockedAt: at("2026-08-03") }] }),
    );
    expect(counts.speciesLearned).toEqual([0, 0, 1]);
  });

  it("runs the signup total forward from the spotters who existed before the range", () => {
    const counts = buildDailyCounts(
      DAYS,
      input({
        usersBefore: 55,
        users: [{ createdAt: at("2026-08-01") }, { createdAt: at("2026-08-03") }],
      }),
    );
    expect(counts.totalSpotters).toEqual([56, 56, 57]);
  });

  it("holds the total flat across a range with no signups", () => {
    expect(buildDailyCounts(DAYS, input({ usersBefore: 89 })).totalSpotters).toEqual([89, 89, 89]);
  });
});

describe("distinctActiveSpotters", () => {
  it("counts a returning spotter once across the whole range", () => {
    const events: EventRow[] = [
      { createdAt: at("2026-08-01"), type: "session_start", value: null, userId: "u1" },
      { createdAt: at("2026-08-02"), type: "session_start", value: null, userId: "u1" },
      { createdAt: at("2026-08-03"), type: "session_start", value: null, userId: "u2" },
    ];
    // Three daily bars of 1, but two people.
    expect(buildDailyCounts(DAYS, input({ events })).activeSpotters).toEqual([1, 1, 1]);
    expect(distinctActiveSpotters(DAYS, events)).toBe(2);
  });

  it("ignores sessions outside the range", () => {
    const events: EventRow[] = [
      { createdAt: at("2026-07-31"), type: "session_start", value: null, userId: "u9" },
      { createdAt: at("2026-08-01"), type: "session_start", value: null, userId: "u1" },
    ];
    expect(distinctActiveSpotters(DAYS, events)).toBe(1);
  });
});

describe("ratioSeries", () => {
  it("returns null, not zero, where there is no denominator", () => {
    expect(ratioSeries([3, 0, 4], [6, 0, 8], 100)).toEqual([50, null, 50]);
  });

  it("is null on a zero denominator even when the numerator is zero too", () => {
    expect(ratioSeries([0], [0])).toEqual([null]);
  });
});

describe("rollingAverage", () => {
  it("averages over the trailing window", () => {
    expect(rollingAverage([2, 4, 6, 8], 2)).toEqual([2, 3, 5, 7]);
  });

  it("averages leading days over what exists so the line starts at the edge", () => {
    expect(rollingAverage([3, 6, 9], 7)).toEqual([3, 4.5, 6]);
  });

  it("passes values straight through for a window of one", () => {
    expect(rollingAverage([1, 2, 3], 1)).toEqual([1, 2, 3]);
  });
});

describe("buildMetricSeries", () => {
  const counts = buildDailyCounts(
    DAYS,
    input({
      usersBefore: 10,
      users: [{ createdAt: at("2026-08-01") }, { createdAt: at("2026-08-02") }],
      answers: [
        { createdAt: at("2026-08-01"), isCorrect: true },
        { createdAt: at("2026-08-01"), isCorrect: false },
        { createdAt: at("2026-08-02"), isCorrect: true },
      ],
      unlocks: [{ firstUnlockedAt: at("2026-08-02") }],
      events: [
        { createdAt: at("2026-08-01"), type: "session_start", value: null, userId: "u1" },
        { createdAt: at("2026-08-02"), type: "session_start", value: null, userId: "u1" },
        { createdAt: at("2026-08-01"), type: "clip_watch", value: 120, userId: "u1" },
        { createdAt: at("2026-08-02"), type: "clip_watch", value: 240, userId: "u1" },
        { createdAt: at("2026-08-01"), type: "clip_view", value: null, userId: "u1" },
      ],
    }),
  );
  const series = buildMetricSeries(counts, { activeInRange: 1 });
  const get = (key: string) => series.find((s) => s.key === key)!;

  it("headlines the running total with its last day, not the sum of its days", () => {
    const total = get("totalSpotters");
    expect(total.values).toEqual([11, 12, 12]);
    expect(total.total).toBe(12);
    expect(total.totalIsSumOfDays).toBe(false);
    expect(total.shape).toBe("line");
  });

  it("sums the plain per-day counts", () => {
    expect(get("newSpotters").total).toBe(2);
    expect(get("identifications").total).toBe(3);
    expect(get("speciesLearned").total).toBe(1);
    expect(get("sessions").total).toBe(2);
    expect(get("clipViews").total).toBe(1);
  });

  it("takes the distinct active count from the range, not from adding the days up", () => {
    const active = get("activeSpotters");
    expect(active.values).toEqual([1, 1, 0]);
    expect(sum(active.values as number[])).toBe(2);
    expect(active.total).toBe(1);
    expect(active.totalIsSumOfDays).toBe(false);
  });

  it("reports watch time in minutes", () => {
    const watch = get("watchMinutes");
    expect(watch.values).toEqual([2, 4, 0]);
    expect(watch.total).toBe(6);
  });

  it("divides watch by sessions over the whole range, not by averaging the daily averages", () => {
    // Daily averages are 2 and 4; the range figure is 6 minutes over 2
    // sessions, which is 3, and the two are not the same operation.
    const perSession = get("watchPerSession");
    expect(perSession.values).toEqual([2, 4, null]);
    expect(perSession.total).toBe(3);
    expect(perSession.totalIsSumOfDays).toBe(false);
  });

  it("computes accuracy over the pooled range and leaves unsettled days blank", () => {
    const accuracy = get("accuracy");
    expect(accuracy.values).toEqual([50, 100, null]);
    expect(accuracy.total).toBeCloseTo((2 / 3) * 100);
    expect(accuracy.unit).toBe("percent");
  });

  it("marks exactly the event-derived metrics, which are the consent-gated ones", () => {
    const flagged = series.filter((s) => s.eventDerived).map((s) => s.key).sort();
    expect(flagged).toEqual([
      "activeSpotters",
      "clipViews",
      "sessions",
      "watchMinutes",
      "watchPerSession",
    ]);
  });

  it("returns a null headline for a ratio with no base at all", () => {
    const empty = buildMetricSeries(buildDailyCounts(DAYS, input()), { activeInRange: 0 });
    expect(empty.find((s) => s.key === "accuracy")!.total).toBeNull();
    expect(empty.find((s) => s.key === "watchPerSession")!.total).toBeNull();
    expect(empty.find((s) => s.key === "newSpotters")!.total).toBe(0);
  });

  it("keeps every series aligned to the day list", () => {
    for (const s of series) expect(s.values).toHaveLength(DAYS.length);
  });
});
