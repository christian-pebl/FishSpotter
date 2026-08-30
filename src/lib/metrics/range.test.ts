import { describe, expect, it } from "vitest";
import {
  DEFAULT_METRIC_RANGE,
  MAX_RANGE_DAYS,
  dayKey,
  dayKeysBetween,
  formatRangeLabel,
  metricRangeQuery,
  parseDayKey,
  parseMetricRange,
} from "./range";

const NOW = new Date("2026-08-30T14:22:00Z");

function parse(params: Record<string, string | string[] | undefined>, earliest?: Date | null) {
  return parseMetricRange(params, { now: NOW, earliest });
}

describe("parseDayKey", () => {
  it("accepts a real day key", () => {
    expect(parseDayKey("2026-08-30")?.toISOString()).toBe("2026-08-30T00:00:00.000Z");
  });

  it("rejects a date that rolls over into the next month", () => {
    // Date() happily parses this and lands on 3 March; accepting it would
    // silently shift the range a few days from what was typed.
    expect(parseDayKey("2026-02-31")).toBeNull();
  });

  it("rejects anything that is not a bare day key", () => {
    expect(parseDayKey("30/08/2026")).toBeNull();
    expect(parseDayKey("2026-08-30T00:00:00Z")).toBeNull();
    expect(parseDayKey("")).toBeNull();
    expect(parseDayKey(undefined)).toBeNull();
  });
});

describe("dayKeysBetween", () => {
  it("is half-open: it includes the start and excludes the end", () => {
    const keys = dayKeysBetween(new Date("2026-08-28T00:00:00Z"), new Date("2026-08-31T00:00:00Z"));
    expect(keys).toEqual(["2026-08-28", "2026-08-29", "2026-08-30"]);
  });

  it("crosses a month boundary without gaps", () => {
    const keys = dayKeysBetween(new Date("2026-07-30T00:00:00Z"), new Date("2026-08-02T00:00:00Z"));
    expect(keys).toEqual(["2026-07-30", "2026-07-31", "2026-08-01"]);
  });
});

describe("parseMetricRange presets", () => {
  it("defaults to 30 calendar days ending today", () => {
    const range = parse({});
    expect(range.preset).toBe(DEFAULT_METRIC_RANGE);
    expect(range.days).toHaveLength(30);
    expect(range.days[0]).toBe("2026-08-01");
    expect(range.days.at(-1)).toBe("2026-08-30");
    expect(range.coerced).toBe(false);
  });

  it("counts today as one of the days, so 7d is today plus the six before", () => {
    const range = parse({ range: "7d" });
    expect(range.days).toEqual([
      "2026-08-24",
      "2026-08-25",
      "2026-08-26",
      "2026-08-27",
      "2026-08-28",
      "2026-08-29",
      "2026-08-30",
    ]);
  });

  it("ends the window at tomorrow's midnight so today's rows are included", () => {
    const range = parse({ range: "7d" });
    expect(range.toExclusive.toISOString()).toBe("2026-08-31T00:00:00.000Z");
  });

  it("gives 12m a full 365 days", () => {
    expect(parse({ range: "12m" }).days).toHaveLength(365);
  });

  it("falls back to the default on an unknown preset and says it was coerced", () => {
    const range = parse({ range: "everything" });
    expect(range.preset).toBe(DEFAULT_METRIC_RANGE);
    expect(range.coerced).toBe(true);
  });

  it("takes the first value when a param is repeated", () => {
    expect(parse({ range: ["7d", "90d"] }).days).toHaveLength(7);
  });
});

describe("parseMetricRange all-time", () => {
  it("starts at the oldest row", () => {
    const range = parse({ range: "all" }, new Date("2026-08-27T09:13:00Z"));
    expect(range.days[0]).toBe("2026-08-27");
    expect(range.days).toHaveLength(4);
    expect(range.coerced).toBe(false);
  });

  it("collapses to today when there is nothing yet", () => {
    const range = parse({ range: "all" }, null);
    expect(range.days).toEqual(["2026-08-30"]);
  });

  it("caps a very old floor and flags the coercion", () => {
    const range = parse({ range: "all" }, new Date("2015-01-01T00:00:00Z"));
    expect(range.days).toHaveLength(MAX_RANGE_DAYS);
    expect(range.coerced).toBe(true);
  });

  it("pins a floor stamped in the future to today rather than inverting the range", () => {
    const range = parse({ range: "all" }, new Date("2027-01-01T00:00:00Z"));
    expect(range.days).toEqual(["2026-08-30"]);
    expect(range.coerced).toBe(true);
  });
});

describe("parseMetricRange custom", () => {
  it("uses both endpoints inclusively", () => {
    const range = parse({ range: "custom", from: "2026-08-01", to: "2026-08-07" });
    expect(range.preset).toBe("custom");
    expect(range.days).toHaveLength(7);
    expect(range.days[0]).toBe("2026-08-01");
    expect(range.days.at(-1)).toBe("2026-08-07");
    expect(range.coerced).toBe(false);
  });

  it("clamps an end date in the future to today", () => {
    const range = parse({ range: "custom", from: "2026-08-25", to: "2026-12-31" });
    expect(range.days.at(-1)).toBe("2026-08-30");
    expect(range.coerced).toBe(true);
  });

  it("truncates from the start when the span exceeds the ceiling", () => {
    const range = parse({ range: "custom", from: "2015-01-01", to: "2026-08-30" });
    expect(range.days).toHaveLength(MAX_RANGE_DAYS);
    expect(range.days.at(-1)).toBe("2026-08-30");
    expect(range.coerced).toBe(true);
  });

  it("falls back when the dates are backwards", () => {
    const range = parse({ range: "custom", from: "2026-08-30", to: "2026-08-01" });
    expect(range.preset).toBe(DEFAULT_METRIC_RANGE);
    expect(range.coerced).toBe(true);
  });

  it("falls back when a date is missing", () => {
    expect(parse({ range: "custom", from: "2026-08-01" }).preset).toBe(DEFAULT_METRIC_RANGE);
    expect(parse({ range: "custom" }).coerced).toBe(true);
  });

  it("falls back when the whole span sits in the future", () => {
    const range = parse({ range: "custom", from: "2026-09-01", to: "2026-09-30" });
    expect(range.preset).toBe(DEFAULT_METRIC_RANGE);
    expect(range.coerced).toBe(true);
  });

  it("accepts a single day", () => {
    const range = parse({ range: "custom", from: "2026-08-14", to: "2026-08-14" });
    expect(range.days).toEqual(["2026-08-14"]);
  });
});

describe("metricRangeQuery", () => {
  it("round-trips a preset", () => {
    const range = parse({ range: "90d" });
    const reparsed = parseMetricRange(
      Object.fromEntries(metricRangeQuery(range).entries()),
      { now: NOW },
    );
    expect(reparsed.days).toEqual(range.days);
  });

  it("round-trips a custom range, endpoints included", () => {
    const range = parse({ range: "custom", from: "2026-07-04", to: "2026-08-02" });
    const query = metricRangeQuery(range);
    expect(query.get("from")).toBe("2026-07-04");
    expect(query.get("to")).toBe("2026-08-02");
    const reparsed = parseMetricRange(Object.fromEntries(query.entries()), { now: NOW });
    expect(reparsed.days).toEqual(range.days);
  });
});

describe("formatRangeLabel", () => {
  it("collapses a repeated month", () => {
    expect(
      formatRangeLabel(new Date("2026-08-01T00:00:00Z"), new Date("2026-08-30T00:00:00Z")),
    ).toBe("1 - 30 Aug 2026");
  });

  it("keeps both months inside one year", () => {
    expect(
      formatRangeLabel(new Date("2026-07-04T00:00:00Z"), new Date("2026-08-02T00:00:00Z")),
    ).toBe("4 Jul - 2 Aug 2026");
  });

  it("spells out both years when the range crosses one", () => {
    expect(
      formatRangeLabel(new Date("2025-12-30T00:00:00Z"), new Date("2026-01-02T00:00:00Z")),
    ).toBe("30 Dec 2025 - 2 Jan 2026");
  });

  it("shows a single day once", () => {
    const d = new Date("2026-08-14T00:00:00Z");
    expect(formatRangeLabel(d, d)).toBe("14 Aug 2026");
  });
});

describe("dayKey", () => {
  it("is UTC, not local", () => {
    expect(dayKey(new Date("2026-08-30T23:59:59Z"))).toBe("2026-08-30");
    expect(dayKey(new Date("2026-08-31T00:00:00Z"))).toBe("2026-08-31");
  });
});
