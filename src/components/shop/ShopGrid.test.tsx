import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShopGrid } from "./ShopGrid";
import type { ShopItem } from "@/lib/shop/catalogue";

// Functional smoke for the shop grid: state rendering (afford / can't-afford /
// owned / held pips / guest) and the purchase flow against a mocked API. The
// animations themselves are a visual concern; this guards the component
// contract they decorate.

const ITEMS: ShopItem[] = [
  {
    id: "gold-nameplate",
    name: "Gold nameplate",
    blurb: "Your spotter name shines gold on your profile.",
    price: 150,
    type: "cosmetic",
    kind: "nameplate",
  },
  {
    id: "tide-freeze",
    name: "Tide Freeze",
    blurb: "Miss a day without losing your streak. Hold up to two.",
    price: 80,
    type: "consumable",
    maxHold: 2,
  },
];

function renderGrid(overrides: Partial<Parameters<typeof ShopGrid>[0]> = {}) {
  return render(
    <ShopGrid
      items={ITEMS}
      ownedItemIds={[]}
      heldByItem={{}}
      initialWallet={200}
      authed
      {...overrides}
    />,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ShopGrid", () => {
  it("renders every item with its price and the coming-soon teaser", () => {
    renderGrid();
    expect(screen.getByText("Gold nameplate")).toBeInTheDocument();
    expect(screen.getByText("Tide Freeze")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("Real-world rewards")).toBeInTheDocument();
  });

  it("shows an earn-toward-it progress line when an item is unaffordable", () => {
    renderGrid({ initialWallet: 60 });
    expect(screen.getByRole("button", { name: "Earn 90 more" })).toBeDisabled();
    expect(screen.getByText(/60 of 150/)).toBeInTheDocument();
  });

  it("marks an already-owned cosmetic as Owned", () => {
    renderGrid({ ownedItemIds: ["gold-nameplate"] });
    expect(screen.getByText("Owned")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Unlock" }),
    ).not.toBeInTheDocument();
  });

  it("shows held pips for a consumable and a Buy another button", () => {
    renderGrid({ heldByItem: { "tide-freeze": 1 } });
    expect(screen.getByText("1/2 held")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buy another" })).toBeEnabled();
  });

  it("disables buying at the hold cap", () => {
    renderGrid({ heldByItem: { "tide-freeze": 2 } });
    expect(screen.getByRole("button", { name: "Stash full" })).toBeDisabled();
  });

  it("gates guests behind sign-in", () => {
    renderGrid({ authed: false });
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Sign in to buy" }).length,
    ).toBeGreaterThan(0);
  });

  it("buys a cosmetic: calls the API, flips to Owned, confirms in place", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, wallet: 50, itemId: "gold-nameplate" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderGrid();
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(screen.getByText("Owned")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/shop/purchase",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ itemId: "gold-nameplate" }),
      }),
    );
    expect(
      screen.getByText("Unlocked — it's live on your profile."),
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
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Not enough Pebbles yet.",
      );
    });
    expect(screen.queryByText("Owned")).not.toBeInTheDocument();
  });
});
