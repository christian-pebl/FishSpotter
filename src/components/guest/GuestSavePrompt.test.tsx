import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = { user: { isGuest: true, ageBand: "18_plus" } };
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: session, update: vi.fn() }),
}));

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GuestSavePrompt } from "./GuestSavePrompt";
import { GUEST_MILESTONE_EVENT, GUEST_PRIZE_EVENT } from "@/lib/guest";
import { AGE_CHECK_REQUEST_EVENT } from "@/lib/age-events";

// The prize version of the guest save prompt (7 Oct 2026): a guest over the
// Pebble target has won a book PEBL can't post without an email.

function fire(name: string) {
  act(() => {
    window.dispatchEvent(new CustomEvent(name));
  });
}

describe("GuestSavePrompt, prize mode", () => {
  beforeEach(() => {
    sessionStorage.clear();
    session.user = { isGuest: true, ageBand: "18_plus" };
  });
  afterEach(() => sessionStorage.clear());

  it("tells a guest over the target they've won, and asks for an email", () => {
    render(<GuestSavePrompt />);
    fire(GUEST_PRIZE_EVENT);
    expect(screen.getByRole("heading", { name: "You've earned the Seasearch guide" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save so we can post it" })).toBeTruthy();
  });

  it("still shows after the clip-3 nudge was dismissed", async () => {
    render(<GuestSavePrompt />);
    fire(GUEST_MILESTONE_EVENT);
    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    fire(GUEST_PRIZE_EVENT);
    expect(screen.getByRole("heading", { name: "You've earned the Seasearch guide" })).toBeTruthy();
  });

  it("shows once per tab after its own Not now", async () => {
    render(<GuestSavePrompt />);
    fire(GUEST_PRIZE_EVENT);
    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    fire(GUEST_PRIZE_EVENT);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks the age first when we don't know it", () => {
    session.user = { isGuest: true, ageBand: "unknown" };
    const asked = vi.fn();
    window.addEventListener(AGE_CHECK_REQUEST_EVENT, asked);
    render(<GuestSavePrompt />);
    fire(GUEST_PRIZE_EVENT);
    window.removeEventListener(AGE_CHECK_REQUEST_EVENT, asked);
    expect(asked).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("never fires for a saved account", () => {
    session.user = { isGuest: false, ageBand: "18_plus" };
    render(<GuestSavePrompt />);
    fire(GUEST_PRIZE_EVENT);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
