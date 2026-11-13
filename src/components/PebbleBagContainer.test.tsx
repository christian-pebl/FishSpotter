import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PebbleBag } from "./PebbleBag";
import { emitPebbles } from "@/lib/pebble-bus";
import { resetLazyComponentsForTests } from "@/lib/useLazyComponent";

/**
 * The container is in the header of every page; the animated pouch (and with
 * it framer-motion) is only fetched for a signed-in spotter, beside the total.
 * A module mock's factory runs on the first import only, so the "guest never
 * fetches it" case must stay first in this file.
 */

let status: "loading" | "authenticated" | "unauthenticated" = "unauthenticated";
vi.mock("next-auth/react", () => ({
  useSession: () => ({ status, data: null }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children?: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const pouch = vi.hoisted(() => ({
  fetches: 0,
  gate: null as Promise<void> | null,
}));
vi.mock("@/components/PebbleBagView", async () => {
  pouch.fetches += 1;
  if (pouch.gate) await pouch.gate;
  return {
    PebbleBagView: ({
      total,
      earn,
    }: {
      total: number;
      earn?: { nonce: number; earned: number } | null;
    }) => (
      <span data-testid="pouch" data-earn={earn ? `${earn.nonce}:${earn.earned}` : ""}>
        {total}
      </span>
    ),
  };
});

const fetchMock = vi.fn();

beforeEach(() => {
  status = "unauthenticated";
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ json: async () => ({ total: 42 }) });
  vi.stubGlobal("fetch", fetchMock);
  resetLazyComponentsForTests();
});

describe("PebbleBag container", () => {
  it("shows nothing, and fetches neither the total nor the pouch, until a spotter is signed in", async () => {
    const { container, rerender } = render(<PebbleBag onFeed={false} />);
    expect(container).toBeEmptyDOMElement();

    status = "loading";
    rerender(<PebbleBag onFeed={false} />);
    await Promise.resolve();

    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(pouch.fetches).toBe(0);
  });

  it("does not show an empty pill while the pouch's code is still on its way", async () => {
    let release!: () => void;
    pouch.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    status = "authenticated";
    render(<PebbleBag onFeed={false} />);

    // The total has arrived, but the pouch has not: no link yet.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/me/pebbles"));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(screen.queryByRole("link")).toBeNull();

    // Both started together: the pouch fetch began with the signed-in session.
    expect(pouch.fetches).toBe(1);

    await act(async () => {
      release();
      pouch.gate = null;
    });
    const link = await screen.findByRole("link", { name: /Your Pebbles: 42/ });
    expect(link).toHaveAttribute("href", "/pebbles");
    expect(link).toHaveAttribute("data-tour", "pebbles");
    expect(screen.getByTestId("pouch")).toHaveTextContent("42");
  });

  it("hands the pouch an earn signal and the authoritative total when a clip is answered", async () => {
    status = "authenticated";
    render(<PebbleBag onFeed />);
    await screen.findByTestId("pouch");

    act(() => emitPebbles({ earned: 30, total: 72, firstSighting: true }));

    const pouchNow = await screen.findByTestId("pouch");
    expect(pouchNow).toHaveTextContent("72");
    expect(pouchNow).toHaveAttribute("data-earn", "1:30");
  });

  it("adds the delta when the event carries no total", async () => {
    status = "authenticated";
    render(<PebbleBag onFeed={false} />);
    await screen.findByTestId("pouch");

    act(() => emitPebbles({ earned: 10, total: 0 }));

    await waitFor(() => expect(screen.getByTestId("pouch")).toHaveTextContent("52"));
  });
});
