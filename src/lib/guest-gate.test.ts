// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GUEST_GATE_CLOSED_EVENT,
  GUEST_GATE_DISMISS_KEY,
  clearGuestGateDismissal,
  dismissGuestGate,
  isGuestGateDismissed,
  shouldHoldVideoForGuestGate,
} from "./guest-gate";

/**
 * The feed holds its clips back while the guest gate covers it (11 Nov 2026:
 * it used to fetch 36 MB on a desktop and 10.9 MB on a phone before the first
 * tap). The two failure modes that matter are opposite: holding when it should
 * not (a signed-in spotter, or a visitor who chose to watch, stares at a
 * poster) and not holding when it should (the bytes come back).
 */
describe("shouldHoldVideoForGuestGate", () => {
  it("never holds for a page the server rendered for a signed-in spotter", () => {
    for (const sessionStatus of ["loading", "authenticated", "unauthenticated"] as const) {
      expect(
        shouldHoldVideoForGuestGate({ signedOutAtRender: false, sessionStatus, dismissed: false }),
      ).toBe(false);
    }
  });

  it("holds for a signed-out visitor while the gate is up, including while the session loads", () => {
    for (const sessionStatus of ["loading", "unauthenticated"] as const) {
      expect(
        shouldHoldVideoForGuestGate({ signedOutAtRender: true, sessionStatus, dismissed: false }),
      ).toBe(true);
    }
  });

  it("releases when the visitor taps 'Just watch for now'", () => {
    expect(
      shouldHoldVideoForGuestGate({
        signedOutAtRender: true,
        sessionStatus: "unauthenticated",
        dismissed: true,
      }),
    ).toBe(false);
  });

  it("releases the moment a guest game starts (the session becomes authenticated)", () => {
    expect(
      shouldHoldVideoForGuestGate({
        signedOutAtRender: true,
        sessionStatus: "authenticated",
        dismissed: false,
      }),
    ).toBe(false);
  });
});

describe("guest gate dismissal", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("is remembered for the tab and announced to the feed", () => {
    const heard = vi.fn();
    window.addEventListener(GUEST_GATE_CLOSED_EVENT, heard);
    expect(isGuestGateDismissed()).toBe(false);

    dismissGuestGate();

    expect(isGuestGateDismissed()).toBe(true);
    expect(sessionStorage.getItem(GUEST_GATE_DISMISS_KEY)).toBe("1");
    expect(heard).toHaveBeenCalledTimes(1);
    window.removeEventListener(GUEST_GATE_CLOSED_EVENT, heard);
  });

  it("keeps the key the gate has always used, so a tab dismissed before this change stays dismissed", () => {
    expect(GUEST_GATE_DISMISS_KEY).toBe("fishspotter:guestGateDismissed");
  });

  it("is forgotten when a guest game starts", () => {
    dismissGuestGate();
    clearGuestGateDismissal();
    expect(isGuestGateDismissed()).toBe(false);
  });

  it("still announces the dismissal when storage is unavailable (private mode)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const heard = vi.fn();
    window.addEventListener(GUEST_GATE_CLOSED_EVENT, heard);
    expect(() => dismissGuestGate()).not.toThrow();
    expect(heard).toHaveBeenCalledTimes(1);
    window.removeEventListener(GUEST_GATE_CLOSED_EVENT, heard);
  });
});
