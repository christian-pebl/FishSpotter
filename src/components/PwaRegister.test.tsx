import { act, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PwaRegister } from "./PwaRegister";
import { resetInstallPromptForTests, useInstallPrompt } from "@/lib/useInstallPrompt";

beforeEach(() => resetInstallPromptForTests());
afterEach(() => resetInstallPromptForTests());

describe("PwaRegister", () => {
  it("catches the browser's install offer for a side menu that has not loaded yet", () => {
    // PwaRegister is mounted on every page and has no animation library in it;
    // the side menu that shows the "Install app" entry is fetched after the
    // first paint. The offer fires once, early, so it has to be caught here.
    render(<PwaRegister />);

    const event = new Event("beforeinstallprompt", { cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);

    // The menu mounts later and finds it waiting.
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.prompt).toBe(event);
  });

  it("still registers the service worker when the browser has one", () => {
    const register = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register },
      configurable: true,
    });

    try {
      // jsdom's document is already "complete", so it registers straight away.
      render(<PwaRegister />);
      expect(register).toHaveBeenCalledWith("/sw.js");
    } finally {
      delete (navigator as unknown as { serviceWorker?: unknown }).serviceWorker;
    }
  });
});
