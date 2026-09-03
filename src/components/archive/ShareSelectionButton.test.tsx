import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShareSelectionButton } from "./ShareSelectionButton";

const PATH = "/feed/browse?site=Dale+Bay%2C+Pembrokeshire%2C+Wales%2C+UK";
const ABSOLUTE = new URL(PATH, window.location.origin).toString();

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

function stubPointer(coarse: boolean) {
  Object.defineProperty(window, "matchMedia", {
    value: (query: string) => ({ matches: coarse && query === "(pointer: coarse)" }),
    configurable: true,
  });
}

function stubShare(share: ((data: ShareData) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, "share", { value: share, configurable: true });
}

beforeEach(() => {
  vi.useFakeTimers();
  stubPointer(false);
  stubShare(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ShareSelectionButton", () => {
  it("copies the absolute link on a desktop and says so", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    render(<ShareSelectionButton path={PATH} title="t" text="x" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /share this selection/i }));
    });

    expect(writeText).toHaveBeenCalledWith(ABSOLUTE);
    expect(screen.getByRole("status")).toHaveTextContent("Link copied");

    // The confirmation clears itself so the row does not read "copied" forever.
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("uses the native share sheet on a touch device", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubPointer(true);
    stubShare(share);
    stubClipboard(writeText);
    render(<ShareSelectionButton path={PATH} title="Clips from Dale Bay" text="Watch them" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /share this selection/i }));
    });

    expect(share).toHaveBeenCalledWith({ title: "Clips from Dale Bay", text: "Watch them", url: ABSOLUTE });
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Shared");
  });

  it("falls back to the clipboard when the share sheet fails for a reason other than dismissal", async () => {
    stubPointer(true);
    stubShare(vi.fn().mockRejectedValue(new Error("not allowed")));
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    render(<ShareSelectionButton path={PATH} title="t" text="x" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /share this selection/i }));
    });

    expect(writeText).toHaveBeenCalledWith(ABSOLUTE);
  });

  it("stays quiet when the reader dismisses the share sheet", async () => {
    stubPointer(true);
    const abort = Object.assign(new Error("cancelled"), { name: "AbortError" });
    stubShare(vi.fn().mockRejectedValue(abort));
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    render(<ShareSelectionButton path={PATH} title="t" text="x" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /share this selection/i }));
    });

    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("shows the link to copy by hand when the clipboard is refused", async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    render(<ShareSelectionButton path={PATH} title="t" text="x" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /share this selection/i }));
    });

    expect(screen.getByLabelText("Link to this selection")).toHaveValue(ABSOLUTE);
  });
});
