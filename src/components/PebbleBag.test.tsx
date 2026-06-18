import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PebbleBagView } from "./PebbleBag";

// Functional smoke for the presentational pouch: it renders the total and
// survives an earn signal (the fly-in burst) without crashing. Smoothness/FPS is
// a visual concern (watch the Storybook "Header/PebbleBag" playground); this just
// guards the component contract.
describe("PebbleBagView", () => {
  it("renders the running total", () => {
    render(<PebbleBagView total={1234} onFeed={false} />);
    expect(screen.getByText("1,234")).toBeInTheDocument();
  });

  it("does not crash when an earn signal fires a burst", () => {
    const { rerender } = render(
      <PebbleBagView total={40} onFeed={false} earn={null} />,
    );
    expect(() =>
      rerender(
        <PebbleBagView
          total={70}
          onFeed
          earn={{ earned: 30, firstSighting: true, nonce: 1 }}
        />,
      ),
    ).not.toThrow();
  });
});
