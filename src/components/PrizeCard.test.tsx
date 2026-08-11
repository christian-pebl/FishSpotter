import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrizeCard } from "./PrizeCard";

// Functional smoke for the prize card: progress / reached / posted / guest
// states and the guide gallery. Animations are a visual concern; this guards
// the component contract they decorate.
//
// The claim flow is gone (11 Aug 2026). The card is now status-only: reaching
// the target is the achievement, and PEBL emails the winner from the
// /admin/prizes desk. The tests that mocked POST /api/prize/claim went with
// the route, replaced by the "no action anywhere on this card" guarantee.

function renderCard(overrides: Partial<Parameters<typeof PrizeCard>[0]> = {}) {
  return render(
    <PrizeCard authed initialEarned={260} guidePosted={false} {...overrides} />,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PrizeCard", () => {
  it("shows progress toward the target while short of it", () => {
    renderCard();
    expect(screen.getByText(/Win the Seasearch marine life ID guide/)).toBeInTheDocument();
    expect(screen.getByText(/260 of 2,000/)).toBeInTheDocument();
    expect(screen.queryByText("PEBL will email you")).not.toBeInTheDocument();
  });

  it("tells a winner PEBL will be in touch, and offers nothing to tap", () => {
    renderCard({ initialEarned: 2400 });
    expect(screen.getByText(/You've won the Seasearch marine life ID guide/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("PEBL will email you");
  });

  it("never renders a claim action at any Pebble count", () => {
    // The whole point of the refactor: a winner has no button to press, so a
    // reintroduced claim path fails here rather than in production.
    for (const earned of [0, 1999, 2000, 2400]) {
      const { unmount } = renderCard({ initialEarned: earned });
      expect(screen.queryByRole("button", { name: /claim/i })).not.toBeInTheDocument();
      unmount();
    }
  });

  it("shows the posted state once an admin has sent the book", () => {
    renderCard({ initialEarned: 2400, guidePosted: true });
    expect(screen.getByText("Guide posted")).toBeInTheDocument();
    expect(screen.queryByText("PEBL will email you")).not.toBeInTheDocument();
  });

  it("prefers the posted state even if the spotter dips below the target", () => {
    // Pebbles are never deducted today, but a posted book must never stop
    // reading as posted.
    renderCard({ initialEarned: 10, guidePosted: true });
    expect(screen.getByText("Guide posted")).toBeInTheDocument();
  });

  it("shows the fallback illustration while no gallery file loads", () => {
    // jsdom's Image() never fires onload/onerror, so the probe never settles,
    // the same rendered state as production before any screenshot is uploaded.
    renderCard();
    expect(
      screen.getByRole("img", {
        name: "Illustration of a fold-out marine identification guide",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next page" })).not.toBeInTheDocument();
  });

  it("shows the guide gallery and flicks to the next page once files load", async () => {
    // Probing uses detached Image() objects; stub them to load instantly so
    // every manifest slot resolves, as in production once screenshots exist.
    class InstantImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal("Image", InstantImage);

    renderCard();
    expect(
      await screen.findByRole("img", { name: "Seasearch guide: front cover" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(
      await screen.findByRole("img", { name: "Seasearch guide: inside page 1" }),
    ).toBeInTheDocument();
  });

  it("sends guests to sign in", () => {
    renderCard({ authed: false, initialEarned: 0 });
    expect(screen.getByRole("link", { name: "Sign in and start earning" })).toBeInTheDocument();
  });
});
