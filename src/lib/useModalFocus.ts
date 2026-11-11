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
 *   5. mark the document while any dialog is open (MODAL_OPEN_ATTR),
 * and restore focus to the opener on close.
 *
 * The hook no-ops while `open` is false, so it is safe to call
 * unconditionally above an early `if (!open) return null`.
 *
 * @param open      whether the dialog is currently mounted/visible
 * @param dialogRef ref to the dialog container whose focusables are trapped
 * @param onClose   called when the user presses Escape
 */
/**
 * Present on <html> while at least one dialog using this hook is open.
 *
 * Page furniture that floats above the content reads it to get out of the way.
 * The cookie notice is the case that forced it: fixed to the bottom of the
 * screen at a higher z-index than any dialog, it sat on top of the guest gate's
 * bottom sheet on a phone and covered two of the three age options, "Just
 * watch for now" and "I have an account" (measured 11 Nov 2026). An age screen
 * with one answer reachable is not a neutral one. See the rule in globals.css.
 */
export const MODAL_OPEN_ATTR = "data-modal-open";

/** How many dialogs are open right now. Dialogs can stack (the ask-a-parent
 *  dialog opens over others), so the attribute is counted, not toggled. */
let openModals = 0;

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

  // 5: mark the document. Its own effect, keyed on `open` alone: the effect
  // below re-runs whenever `onClose` changes identity, which for most callers
  // is every render.
  useEffect(() => {
    if (!open) return;
    openModals += 1;
    document.documentElement.setAttribute(MODAL_OPEN_ATTR, "");
    return () => {
      openModals = Math.max(0, openModals - 1);
      if (openModals === 0) document.documentElement.removeAttribute(MODAL_OPEN_ATTR);
    };
  }, [open]);

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
