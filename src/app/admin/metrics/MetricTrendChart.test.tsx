import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetricTrendChart } from "./MetricTrendChart";
import type { MetricSeries } from "@/lib/metrics/series";

function days(n: number, from = new Date("2026-08-01T00:00:00Z")): string[] {
  return Array.from({ length: n }, (_, i) =>
    new Date(from.getTime() + i * 86_400_000).toISOString().slice(0, 10),
  );
}

function series(overrides: Partial<MetricSeries> = {}): MetricSeries {
  return {
    key: "sessions",
    label: "Sessions",
    sub: "tab sessions",
    unit: "count",
    shape: "bars",
    values: [3, 0, 5],
    total: 8,
    totalIsSumOfDays: true,
    eventDerived: true,
    ...overrides,
  };
}

function bars(container: HTMLElement) {
  return container.querySelectorAll('rect[class*="fill-teal"]');
}

describe("MetricTrendChart bars", () => {
  it("draws one bar per day with something in it", () => {
    const { container } = render(
      <MetricTrendChart series={series()} days={days(3)} firstEventDay={null} />,
    );
    // Three days, but the middle one is zero and has no bar to draw.
    expect(bars(container)).toHaveLength(2);
  });

  it("draws no bar for a day with no data, rather than a zero bar", () => {
    // A ratio's blank day means "no denominator", and a 0% bar would invent a
    // collapse that never happened.
    const { container } = render(
      <MetricTrendChart
        series={series({ unit: "percent", values: [50, null, 100], total: 75 })}
        days={days(3)}
        firstEventDay={null}
      />,
    );
    expect(bars(container)).toHaveLength(2);
  });

  it("says so when the whole range is empty", () => {
    render(
      <MetricTrendChart
        series={series({ values: [0, 0, 0], total: 0 })}
        days={days(3)}
        firstEventDay={null}
      />,
    );
    expect(screen.getByText(/nothing recorded for this metric/i)).toBeInTheDocument();
  });
});

describe("MetricTrendChart shapes", () => {
  it("draws a running total as a line, not as bars", () => {
    const { container } = render(
      <MetricTrendChart
        series={series({ key: "totalSpotters", shape: "line", values: [80, 81, 83], total: 83 })}
        days={days(3)}
        firstEventDay={null}
      />,
    );
    expect(bars(container)).toHaveLength(0);
    expect(container.querySelector('path[class*="stroke-teal-600"]')).toBeInTheDocument();
  });

  it("adds a rolling-average line once the range is long enough to be noisy", () => {
    const long = days(60);
    const { container } = render(
      <MetricTrendChart
        series={series({ values: long.map((_, i) => (i % 3) + 1), total: 120 })}
        days={long}
        firstEventDay={null}
      />,
    );
    expect(container.querySelector('path[class*="stroke-navy-900"]')).toBeInTheDocument();
    expect(screen.getByText(/7-day average/i)).toBeInTheDocument();
  });

  it("starts the rolling line where measurement starts, not before it", () => {
    // Run it through the unmeasured days and it draws a confident flat zero
    // across exactly the period the shading exists to disclaim.
    const long = days(60);
    const { container } = render(
      <MetricTrendChart
        series={series({ values: long.map((_, i) => (i % 3) + 1), total: 120 })}
        days={long}
        firstEventDay={long[20]}
      />,
    );
    const shade = container.querySelector('rect[class*="fill-navy-100"]')!;
    const shadeEnd = Number(shade.getAttribute("x")) + Number(shade.getAttribute("width"));
    const line = container.querySelector('path[class*="stroke-navy-900"]')!;
    const firstX = Number(/^M([\d.]+),/.exec(line.getAttribute("d") ?? "")?.[1]);
    expect(firstX).toBeGreaterThanOrEqual(shadeEnd);
  });

  it("leaves the rolling line off a short range, where the bars read fine alone", () => {
    const { container } = render(
      <MetricTrendChart series={series()} days={days(3)} firstEventDay={null} />,
    );
    expect(container.querySelector('path[class*="stroke-navy-900"]')).not.toBeInTheDocument();
  });
});

describe("MetricTrendChart unmeasured period", () => {
  it("shades and labels the days before the analytics log existed", () => {
    const { container } = render(
      <MetricTrendChart series={series()} days={days(3)} firstEventDay="2026-08-03" />,
    );
    expect(container.querySelector('rect[class*="fill-navy-100"]')).toBeInTheDocument();
    expect(screen.getByText(/before analytics existed/i)).toBeInTheDocument();
  });

  it("leaves a metric that predates the log alone", () => {
    // Signups and IDs are complete back to launch, so their early days are
    // real zeroes and must not be shaded as unmeasured.
    const { container } = render(
      <MetricTrendChart
        series={series({ key: "newSpotters", eventDerived: false })}
        days={days(3)}
        firstEventDay="2026-08-03"
      />,
    );
    expect(container.querySelector('rect[class*="fill-navy-100"]')).not.toBeInTheDocument();
    expect(screen.queryByText(/before analytics existed/i)).not.toBeInTheDocument();
  });

  it("shades nothing when the range starts after the log did", () => {
    const { container } = render(
      <MetricTrendChart series={series()} days={days(3)} firstEventDay="2026-07-01" />,
    );
    expect(container.querySelector('rect[class*="fill-navy-100"]')).not.toBeInTheDocument();
  });
});

describe("MetricTrendChart readout", () => {
  it("reports the peak day, the average and the latest day", () => {
    render(<MetricTrendChart series={series()} days={days(3)} firstEventDay={null} />);
    const readout = (term: string) => screen.getByText(term).nextElementSibling?.textContent;
    expect(readout("Peak")).toBe("5 on 3 Aug 2026");
    // A daily average keeps its decimal: rounded, 2.7 and 3.4 would both read "3".
    expect(readout("Daily average")).toBe("2.7"); // (3 + 0 + 5) / 3
    expect(readout("Latest")).toBe("5 on 3 Aug 2026");
  });

  it("can be scrubbed with the keyboard, not only the mouse", () => {
    render(<MetricTrendChart series={series()} days={days(3)} firstEventDay={null} />);
    const chart = screen.getByRole("img");

    fireEvent.keyDown(chart, { key: "End" });
    expect(screen.getByText("3 Aug 2026")).toBeInTheDocument();

    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    // Scoped to the tooltip: "0" is also an axis label, and the assertion has
    // to be about the readout, not about the chart happening to contain a zero.
    const tooltip = screen.getByText("2 Aug 2026").parentElement;
    expect(tooltip?.textContent).toContain("0");

    fireEvent.keyDown(chart, { key: "Escape" });
    expect(screen.queryByText("2 Aug 2026")).not.toBeInTheDocument();
  });

  it("says 'no data' rather than zero when scrubbed onto a blank day", () => {
    render(
      <MetricTrendChart
        series={series({ unit: "percent", values: [50, null, 100] })}
        days={days(3)}
        firstEventDay={null}
      />,
    );
    fireEvent.keyDown(screen.getByRole("img"), { key: "Home" });
    fireEvent.keyDown(screen.getByRole("img"), { key: "ArrowRight" });
    expect(screen.getByText("no data")).toBeInTheDocument();
  });

  it("summarises itself for a screen reader, which cannot read the bars", () => {
    render(<MetricTrendChart series={series()} days={days(3)} firstEventDay={null} />);
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /Sessions, tab sessions, day by day from 1 Aug 2026 to 3 Aug 2026\. Peak 5 on 3 Aug 2026\./i,
    );
  });
});
