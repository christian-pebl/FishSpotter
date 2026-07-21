import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrizeCard } from "./PrizeCard";

// Functional smoke for the prize card: progress / claimable / gated / claimed /
// guest states and the claim flow against a mocked API. Animations are a
// visual concern; this guards the component contract they decorate.

function renderCard(overrides: Partial<Parameters<typeof PrizeCard>[0]> = {}) {
  return render(
    <PrizeCard
      authed
      initialEarned={260}
      initiallyClaimed={false}
      eligibility={{ eligible: true, reason: null }}
      {...overrides}
    />,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PrizeCard", () => {
  it("shows progress toward the target while short of it, with no claim button", () => {
    renderCard();
    expect(screen.getByText(/Win the Seasearch marine life ID guide/)).toBeInTheDocument();
    expect(screen.getByText(/260 of 2,000/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Claim your guide" })).not.toBeInTheDocument();
  });

  it("offers the claim once the target is reached", () => {
    renderCard({ initialEarned: 2400 });
    expect(screen.getByRole("button", { name: "Claim your guide" })).toBeEnabled();
  });

  it("gates a reached target behind eligibility with a reason", () => {
    renderCard({
      initialEarned: 2400,
      eligibility: {
        eligible: false,
        reason: "Verify your email to claim the guide — prizes are posted to real spotters.",
      },
    });
    expect(screen.getByRole("button", { name: "Claim your guide" })).toBeDisabled();
    expect(screen.getByText(/Verify your email to claim the guide/)).toBeInTheDocument();
  });

  it("shows the claimed state", () => {
    renderCard({ initialEarned: 2400, initiallyClaimed: true });
    expect(screen.getByText("Claimed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Claim your guide" })).not.toBeInTheDocument();
  });

  it("shows the fallback illustration while no gallery file loads", () => {
    // jsdom's Image() never fires onload/onerror, so the probe never settles —
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
    // every manifest slot resolves — production once screenshots exist.
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
      await screen.findByRole("img", { name: "Seasearch guide — front cover" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(
      await screen.findByRole("img", { name: "Seasearch guide — inside page 1" }),
    ).toBeInTheDocument();
  });

  it("sends guests to sign in", () => {
    renderCard({ authed: false, initialEarned: 0, eligibility: null });
    expect(screen.getByRole("link", { name: "Sign in and start earning" })).toBeInTheDocument();
  });

  it("claims: calls the API, flips to Claimed, confirms delivery in place", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, itemId: "seasearch-guide" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderCard({ initialEarned: 2400 });
    await userEvent.click(screen.getByRole("button", { name: "Claim your guide" }));

    await waitFor(() => {
      expect(screen.getByText("Claimed")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/prize/claim", { method: "POST" });
    expect(
      screen.getByText("Claimed! PEBL will email you to arrange delivery."),
    ).toBeInTheDocument();
  });

  it("surfaces a server rejection as an alert without flipping state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Prize claims unlock with a bit more spotting history." }),
      }),
    );

    renderCard({ initialEarned: 2400 });
    await userEvent.click(screen.getByRole("button", { name: "Claim your guide" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/more spotting history/);
    });
    expect(screen.queryByText("Claimed")).not.toBeInTheDocument();
  });
});
