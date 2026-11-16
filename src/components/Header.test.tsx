import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "./Header";
import { resetLazyComponentsForTests } from "@/lib/useLazyComponent";

/**
 * The header is in the root layout, so whatever it imports statically is in the
 * JavaScript of every first visit. The side menu (framer-motion) is fetched
 * after the first paint, or sooner if the menu button is touched. These pin
 * that down, and that opening the menu keeps working however early it is tapped.
 */

let painted = false;
vi.mock("@/lib/useAfterFirstPaint", () => ({
  useAfterFirstPaint: () => painted,
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children?: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// The Pebble bag container has its own tests; here it is just a placeholder.
vi.mock("@/components/PebbleBag", () => ({ PebbleBag: () => null }));

// Counts how many times the side menu's module is actually fetched. A module
// mock's factory runs on the first import only, so the one test that asserts
// "not fetched yet" must stay first in this file.
const menuModule = vi.hoisted(() => ({ fetches: 0 }));
vi.mock("@/components/SideMenu", () => {
  menuModule.fetches += 1;
  return {
    SideMenu: ({ open, onClose }: { open: boolean; onClose: () => void }) => (
      <div data-testid="side-menu" data-open={String(open)}>
        <button type="button" onClick={onClose}>
          Close menu
        </button>
      </div>
    ),
  };
});

const menuButton = () => screen.getByRole("button", { name: "Open menu" });

beforeEach(() => {
  painted = false;
  resetLazyComponentsForTests();
});

describe("Header", () => {
  it("does not fetch the side menu before the page has painted", async () => {
    render(<Header />);
    await Promise.resolve();

    expect(menuModule.fetches).toBe(0);
    expect(screen.queryByTestId("side-menu")).toBeNull();
    // The button itself is there from the first byte of HTML.
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
  });

  it("fetches it once the page has painted, and mounts it closed", async () => {
    painted = true;
    render(<Header />);

    const menu = await screen.findByTestId("side-menu");
    expect(menu).toHaveAttribute("data-open", "false");
    expect(menuModule.fetches).toBe(1);
  });

  it("opens the menu the moment its code lands when a tap beats the fetch", async () => {
    // First open on a slow connection, before the after-paint fetch has run.
    const user = userEvent.setup();
    render(<Header />);
    expect(screen.queryByTestId("side-menu")).toBeNull();

    await user.click(menuButton());

    const menu = await screen.findByTestId("side-menu");
    expect(menu).toHaveAttribute("data-open", "true");
    expect(menuButton()).toHaveAttribute("aria-expanded", "true");
  });

  it("starts the fetch when the button is touched, a beat before the click", async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.hover(menuButton());

    const menu = await screen.findByTestId("side-menu");
    expect(menu).toHaveAttribute("data-open", "false");
  });

  it("opens and closes the already-loaded menu", async () => {
    painted = true;
    const user = userEvent.setup();
    render(<Header />);
    await screen.findByTestId("side-menu");

    await user.click(menuButton());
    expect(screen.getByTestId("side-menu")).toHaveAttribute("data-open", "true");
    expect(menuButton()).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: "Close menu" }));
    expect(screen.getByTestId("side-menu")).toHaveAttribute("data-open", "false");
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
  });
});
