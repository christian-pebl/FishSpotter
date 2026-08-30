import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MetricsDashboard, type MetricsDashboardProps } from "./MetricsDashboard";
import { buildDailyCounts, buildMetricSeries, type SeriesInput } from "@/lib/metrics/series";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

afterEach(() => {
  push.mockReset();
});

const DAYS = ["2026-08-28", "2026-08-29", "2026-08-30"];

function at(day: string, time = "10:00:00"): Date {
  return new Date(`${day}T${time}Z`);
}

function fixtureSeries() {
  const input: SeriesInput = {
    usersBefore: 80,
    users: [{ createdAt: at("2026-08-28") }, { createdAt: at("2026-08-30") }],
    answers: [
      { createdAt: at("2026-08-28"), isCorrect: true },
      { createdAt: at("2026-08-28"), isCorrect: false },
      { createdAt: at("2026-08-30"), isCorrect: null },
    ],
    unlocks: [{ firstUnlockedAt: at("2026-08-29") }],
    events: [
      { createdAt: at("2026-08-29"), type: "session_start", value: null, userId: "u1" },
      { createdAt: at("2026-08-30"), type: "session_start", value: null, userId: "u2" },
      { createdAt: at("2026-08-29"), type: "clip_watch", value: 600, userId: "u1" },
      { createdAt: at("2026-08-29"), type: "clip_view", value: null, userId: "u1" },
      { createdAt: at("2026-08-30"), type: "clip_view", value: null, userId: "u2" },
    ],
  };
  return buildMetricSeries(buildDailyCounts(DAYS, input), { activeInRange: 2 });
}

function renderDashboard(overrides: Partial<MetricsDashboardProps> = {}) {
  const props: MetricsDashboardProps = {
    series: fixtureSeries(),
    days: DAYS,
    preset: "30d",
    rangeLabel: "28 - 30 Aug 2026",
    fromDay: "2026-08-28",
    toDay: "2026-08-30",
    todayDay: "2026-08-30",
    previousTotals: { newSpotters: 1, sessions: 4, identifications: 3 },
    previousLabel: "2026-08-25 to 2026-08-27",
    firstEventDay: "2026-08-29",
    topSources: [{ label: "reddit.com", count: 4 }],
    exportHref: "/api/admin/metrics/export?range=30d",
    coerced: false,
    ...overrides,
  };
  return { ...render(<MetricsDashboard {...props} />), props };
}

// Anchored: "Spotters" is a substring of "New spotters" and "Active spotters",
// so an unanchored match finds three cards and fails on the wrong thing.
function card(label: string) {
  return screen.getByRole("button", { name: new RegExp(`^${label}`, "i") });
}

describe("MetricsDashboard cards", () => {
  it("renders every metric as a card with its range headline", () => {
    renderDashboard();
    expect(card("Spotters")).toHaveTextContent("82");
    expect(card("New spotters")).toHaveTextContent("2");
    expect(card("Identifications")).toHaveTextContent("3");
    expect(card("Species learned")).toHaveTextContent("1");
    expect(card("Watch time")).toHaveTextContent("10.0 min");
  });

  it("starts with every card closed", () => {
    renderDashboard();
    expect(card("Sessions")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("opens a day-by-day chart when a card is clicked", () => {
    renderDashboard();
    fireEvent.click(card("Identifications"));

    expect(card("Identifications")).toHaveAttribute("aria-expanded", "true");
    const panel = screen.getByRole("region", { name: /identifications/i });
    expect(within(panel).getByRole("img", { name: /day by day/i })).toBeInTheDocument();
  });

  it("closes the chart when the same card is clicked again", () => {
    renderDashboard();
    fireEvent.click(card("Sessions"));
    expect(screen.getByRole("region")).toBeInTheDocument();
    fireEvent.click(card("Sessions"));
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("keeps one chart open at a time", () => {
    renderDashboard();
    fireEvent.click(card("Sessions"));
    fireEvent.click(card("Clips watched"));
    expect(card("Sessions")).toHaveAttribute("aria-expanded", "false");
    expect(card("Clips watched")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("region")).toHaveLength(1);
  });

  it("warns inside the panel when the bars deliberately over-add", () => {
    renderDashboard();
    fireEvent.click(card("Active spotters"));
    expect(screen.getByText(/not meant to be added up/i)).toBeInTheDocument();
  });

  it("says nothing of the kind for a plain summed metric", () => {
    renderDashboard();
    fireEvent.click(card("Sessions"));
    expect(screen.queryByText(/not meant to be added up/i)).not.toBeInTheDocument();
  });

  it("does not talk about bars on a chart that has no bars", () => {
    // The running total is drawn as a line, so a note about its bars would be
    // describing something that is not on screen.
    renderDashboard();
    fireEvent.click(card("Spotters"));
    expect(screen.queryByText(/not meant to be added up/i)).not.toBeInTheDocument();
  });
});

describe("MetricsDashboard period comparison", () => {
  it("shows the change against the previous window", () => {
    renderDashboard();
    // 2 new spotters against 1 in the window before.
    expect(card("New spotters")).toHaveTextContent("+100%");
    // 2 sessions against 4.
    expect(card("Sessions")).toHaveTextContent("-50%");
  });

  it("leaves the pill off entirely when there is no comparison window", () => {
    renderDashboard({ previousTotals: null, previousLabel: null });
    expect(card("New spotters")).not.toHaveTextContent("%");
  });

  it("spells the change out for a screen reader, since the sign is visual", () => {
    renderDashboard();
    expect(
      within(card("Sessions")).getByText(/down 50 percent on the previous period/i),
    ).toBeInTheDocument();
  });
});

describe("MetricsDashboard range picker", () => {
  it("navigates to the chosen preset", () => {
    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: "90 days" }));
    expect(push).toHaveBeenCalledWith("/admin/metrics?range=90d", { scroll: false });
  });

  it("collapses the open chart before loading a different range", () => {
    // The open chart belongs to the old range; leaving it up would show two
    // ranges at once while the new one loads.
    renderDashboard();
    fireEvent.click(card("Sessions"));
    fireEvent.click(screen.getByRole("button", { name: "7 days" }));
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("marks the active preset as pressed", () => {
    renderDashboard({ preset: "90d" });
    expect(screen.getByRole("button", { name: "90 days" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "30 days" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("submits a custom range from the two date inputs", () => {
    renderDashboard({ preset: "custom" });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-07-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-07-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(push).toHaveBeenCalledWith(
      "/admin/metrics?range=custom&from=2026-07-01&to=2026-07-31",
      { scroll: false },
    );
  });

  it("refuses to apply a backwards custom range", () => {
    renderDashboard({ preset: "custom" });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-07-31" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-07-01" } });
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  it("stops either date input from reaching into the future", () => {
    renderDashboard({ preset: "custom" });
    expect(screen.getByLabelText("To")).toHaveAttribute("max", "2026-08-30");
  });
});

describe("MetricsDashboard context", () => {
  it("carries the range through to the CSV export link", () => {
    renderDashboard({ exportHref: "/api/admin/metrics/export?range=custom&from=a&to=b" });
    expect(screen.getByRole("link", { name: /export csv/i })).toHaveAttribute(
      "href",
      "/api/admin/metrics/export?range=custom&from=a&to=b",
    );
  });

  it("scopes the traffic sources to the range", () => {
    renderDashboard();
    expect(screen.getByText("reddit.com")).toBeInTheDocument();
  });

  it("says when a requested range had to be adjusted", () => {
    renderDashboard({ coerced: true });
    expect(screen.getByText(/could not be used as asked for/i)).toBeInTheDocument();
  });

  it("stays quiet about coercion when the range was honoured", () => {
    renderDashboard();
    expect(screen.queryByText(/could not be used as asked for/i)).not.toBeInTheDocument();
  });

  it("explains that the analytics-log metrics are consent-gated", () => {
    renderDashboard();
    expect(screen.getByText(/only spotters who accepted analytics/i)).toBeInTheDocument();
  });
});
