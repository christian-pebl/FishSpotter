// Smoke test proving the jsdom + testing-library wiring is live.
// Lives under src/components/** so environmentMatchGlobs routes it to jsdom;
// it renders a trivial component and asserts via a jest-dom matcher (which is
// only registered if vitest.setup.ts ran).
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

function Hello() {
  return <p>hello fishspotter</p>;
}

describe("jsdom render smoke", () => {
  it("renders a component and finds its text in the document", () => {
    render(<Hello />);
    expect(screen.getByText("hello fishspotter")).toBeInTheDocument();
  });
});
