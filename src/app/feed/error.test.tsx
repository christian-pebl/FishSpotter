import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import type { ReactNode } from "react";

// Isolate the boundary from MarineFrame's decorative internals and Sentry.
vi.mock("@/components/MarineFrame", () => ({
  MarineFrame: ({ children }: { children?: ReactNode }) => children,
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import FeedError from "./error";

afterEach(() => vi.restoreAllMocks());

describe("FeedError (feed segment boundary)", () => {
  it("renders a recoverable message and calls reset on 'Try again'", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();
    render(<FeedError error={new Error("boom")} reset={reset} />);
    expect(screen.getByText(/couldn't load the feed/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("shows the error digest when present", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = Object.assign(new Error("boom"), { digest: "abc123" });
    render(<FeedError error={err} reset={vi.fn()} />);
    expect(screen.getByText(/abc123/)).toBeInTheDocument();
  });
});
