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
    expect(screen.getByText(/260 of 1,000/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Claim your guide" })).not.toBeInTheDocument();
  });

  it("offers the claim once the target is reached", () => {
    renderCard({ initialEarned: 1200 });
    expect(screen.getByRole("button", { name: "Claim your guide" })).toBeEnabled();
  });

  it("gates a reached target behind eligibility with a reason", () => {
    renderCard({
      initialEarned: 1200,
      eligibility: {
        eligible: false,
        reason: "Verify your email to claim the guide — prizes are posted to real spotters.",
      },
    });
    expect(screen.getByRole("button", { name: "Claim your guide" })).toBeDisabled();
    expect(screen.getByText(/Verify your email to claim the guide/)).toBeInTheDocument();
  });

  it("shows the claimed state", () => {
    renderCard({ initialEarned: 1200, initiallyClaimed: true });
    expect(screen.getByText("Claimed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Claim your guide" })).not.toBeInTheDocument();
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

    renderCard({ initialEarned: 1200 });
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

    renderCard({ initialEarned: 1200 });
    await userEvent.click(screen.getByRole("button", { name: "Claim your guide" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/more spotting history/);
    });
    expect(screen.queryByText("Claimed")).not.toBeInTheDocument();
  });
});
