// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  armInstallPrompt,
  resetInstallPromptForTests,
  useInstallPrompt,
} from "./useInstallPrompt";

/** A stand-in for the browser's one-off install offer. */
function offerInstall() {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  Object.assign(event, {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

beforeEach(() => resetInstallPromptForTests());
afterEach(() => resetInstallPromptForTests());

describe("useInstallPrompt", () => {
  it("keeps an offer that arrives before anything is looking, for a consumer that mounts later", () => {
    // The side menu is loaded late, so the offer has to survive without it.
    armInstallPrompt();
    const event = offerInstall();

    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.prompt).toBe(event);
  });

  it("stops the browser's own install bar, so the menu entry is the one offer", () => {
    armInstallPrompt();
    expect(offerInstall().defaultPrevented).toBe(true);
  });

  it("shows an offer that arrives while a consumer is mounted", () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.prompt).toBeNull();

    const event = offerInstall();
    expect(result.current.prompt).toBe(event);
  });

  it("has nothing to show when the browser never offers (iOS Safari, an installed app)", () => {
    armInstallPrompt();
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.prompt).toBeNull();
  });

  it("forgets the offer once the app is installed", () => {
    armInstallPrompt();
    offerInstall();
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.prompt).not.toBeNull();

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(result.current.prompt).toBeNull();
  });

  it("clear() forgets the offer for every consumer (it can only be used once)", () => {
    armInstallPrompt();
    offerInstall();
    const first = renderHook(() => useInstallPrompt());
    const second = renderHook(() => useInstallPrompt());
    expect(second.result.current.prompt).not.toBeNull();

    act(() => first.result.current.clear());
    expect(first.result.current.prompt).toBeNull();
    expect(second.result.current.prompt).toBeNull();
  });

  it("arms itself when a consumer mounts first, and only ever listens once", () => {
    const add = vi.spyOn(window, "addEventListener");
    renderHook(() => useInstallPrompt());
    armInstallPrompt();
    armInstallPrompt();
    const installListeners = add.mock.calls.filter(([type]) => type === "beforeinstallprompt");
    expect(installListeners).toHaveLength(1);
    add.mockRestore();
  });
});
