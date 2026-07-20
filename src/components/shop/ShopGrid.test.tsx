import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShopGrid } from "./ShopGrid";
import type { ShopItem } from "@/lib/shop/catalogue";

// Functional smoke for the shop grid: state rendering (afford / can't-afford /
// redeemed / gated / guest) and the redemption flow against a mocked API. The
// animations themselves are a visual concern; this guards the component
// contract they decorate.

const GUIDE: ShopItem = {
  id: "fsc-rockpool-guide",
  name: "FSC rockpool ID guide",
  blurb:
    "A real Field Studies Council fold-out guide to UK rockpool wildlife, posted to you by PEBL.",
  price: 1000,
  type: "prize",
};

function renderGrid(overrides: Partial<Parameters<typeof ShopGrid>[0]> = {}) {
  return render(
    <ShopGrid
      items={[GUIDE]}
      ownedItemIds={[]}
      heldByItem={{}}
      initialWallet={1200}
      authed
      prizeEligibility={{ eligible: true, reason: null }}
      {...overrides}
    />,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ShopGrid", () => {
  it("renders the prize with its price and imagery", () => {
    renderGrid();
    expect(screen.getByText("FSC rockpool ID guide")).toBeInTheDocument();
    expect(screen.getByText("1,000")).toBeInTheDocument();
    expect(screen.getByText("Real-world prize")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Fold-out rockpool identification chart" }),
    ).toBeInTheDocument();
  });

  it("shows an earn-toward-it progress line when the prize is unaffordable", () => {
    renderGrid({ initialWallet: 260 });
    expect(screen.getByRole("button", { name: "Earn 740 more" })).toBeDisabled();
    expect(screen.getByText(/260 of 1,000/)).toBeInTheDocument();
  });

  it("gates an affordable redemption behind prize eligibility with a reason", () => {
    renderGrid({
      prizeEligibility: {
        eligible: false,
        reason: "Verify your email to redeem prizes — they're posted to real spotters.",
      },
    });
    expect(screen.getByRole("button", { name: "Redeem" })).toBeDisabled();
    expect(
      screen.getByText(/Verify your email to redeem prizes/),
    ).toBeInTheDocument();
  });

  it("marks an already-redeemed prize as Redeemed", () => {
    renderGrid({ ownedItemIds: [GUIDE.id] });
    expect(screen.getByText("Redeemed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Redeem" })).not.toBeInTheDocument();
  });

  it("gates guests behind sign-in", () => {
    renderGrid({ authed: false, prizeEligibility: null });
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in to redeem" })).toBeDisabled();
  });

  it("redeems: calls the API, flips to Redeemed, confirms delivery in place", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, wallet: 200, itemId: GUIDE.id }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderGrid();
    await userEvent.click(screen.getByRole("button", { name: "Redeem" }));

    await waitFor(() => {
      expect(screen.getByText("Redeemed")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/shop/purchase",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ itemId: GUIDE.id }),
      }),
    );
    expect(
      screen.getByText("Redeemed! PEBL will email you to arrange delivery."),
    ).toBeInTheDocument();
  });

  it("surfaces a server rejection as an alert without changing state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Not enough Pebbles yet." }),
      }),
    );

    renderGrid();
    await userEvent.click(screen.getByRole("button", { name: "Redeem" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Not enough Pebbles yet.");
    });
    expect(screen.queryByText("Redeemed")).not.toBeInTheDocument();
  });
});
