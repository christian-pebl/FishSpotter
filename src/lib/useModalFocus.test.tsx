// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRef } from "react";
import { MODAL_OPEN_ATTR, useModalFocus } from "./useModalFocus";

/**
 * While any dialog is open, <html> carries MODAL_OPEN_ATTR, and globals.css
 * hides the cookie notice under it. On a phone the notice used to sit on top
 * of the guest gate and cover two of the three age answers (11 Nov 2026).
 */
function useDialog(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(open, ref, () => {});
}

const marked = () => document.documentElement.hasAttribute(MODAL_OPEN_ATTR);

describe("useModalFocus document marker", () => {
  it("is set while a dialog is open and cleared when it closes", () => {
    const { rerender, unmount } = renderHook(({ open }) => useDialog(open), {
      initialProps: { open: false },
    });
    expect(marked()).toBe(false);

    rerender({ open: true });
    expect(marked()).toBe(true);

    rerender({ open: false });
    expect(marked()).toBe(false);
    unmount();
  });

  it("stays set until the LAST of two stacked dialogs closes", () => {
    const a = renderHook(({ open }) => useDialog(open), { initialProps: { open: true } });
    const b = renderHook(({ open }) => useDialog(open), { initialProps: { open: true } });
    expect(marked()).toBe(true);

    b.rerender({ open: false });
    expect(marked()).toBe(true);

    a.rerender({ open: false });
    expect(marked()).toBe(false);
    a.unmount();
    b.unmount();
  });

  it("is cleared when an open dialog unmounts without closing first", () => {
    const { unmount } = renderHook(() => useDialog(true));
    expect(marked()).toBe(true);
    unmount();
    expect(marked()).toBe(false);
  });
});
