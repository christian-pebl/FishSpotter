import { useEffect } from "react";
import type { RefObject } from "react";

/**
 * Shared modal focus-management hook.
 *
 * Implements the WCAG 2.1.2 ("No Keyboard Trap" / focus-containment)
 * contract that IdGuideSheet and SideMenu already satisfy by hand, so any
 * dialog can inherit it instead of re-implementing the same four effects:
 *   1. remember the element that had focus before the dialog opened,
 *   2. move focus into the first focusable inside the dialog on open,
 *   3. trap Tab / Shift+Tab within the dialog and close on Escape,
 *   4. lock body scroll while open,
 * and restore focus to the opener on close.
 *
 * The hook no-ops while `open` is false, so it is safe to call
 * unconditionally above an early `if (!open) return null`.
 *
 * @param open      whether the dialog is currently mounted/visible
 * @param dialogRef ref to the dialog container whose focusables are trapped
 * @param onClose   called when the user presses Escape
 */
export function useModalFocus(
  open: boolean,
  dialogRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  // 1 + restore: remember the opener, refocus it on close.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    return () => {
      previouslyFocused?.focus?.();
    };
  }, [open]);

  // 2: move focus into the dialog on open.
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = dialog.querySelector<HTMLElement>(
      "input, textarea, button:not([disabled]), [tabindex]:not([tabindex='-1'])",
    );
    focusable?.focus();
  }, [open, dialogRef]);

  // 3 + 4: Escape, Tab trap, body scroll lock.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, dialogRef, onClose]);
}
