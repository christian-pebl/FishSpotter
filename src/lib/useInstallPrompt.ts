"use client";

import { useCallback, useSyncExternalStore } from "react";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

/**
 * The browser's deferred install prompt, if it ever offered one.
 *
 * `beforeinstallprompt` fires once, early, and is lost if nothing is listening.
 * The listener used to live in the side menu, which meant the menu had to be in
 * the first JavaScript every visitor downloads. It is now a tiny shared store:
 * `PwaRegister` (always mounted, no animation library) arms the listener at
 * hydration, and whichever component wants the event, the side menu being the
 * only one today, reads it from here whenever it appears. The menu can be loaded
 * late, or never, without the "Install app" entry being lost.
 *
 * One owner of the state, so the menu and the button can never disagree about
 * whether there is anything to show: the button renders nothing far more often
 * than not (iOS Safari never fires the event, and neither does an installed
 * app), and a menu section drawn around nothing is a stray divider.
 */

let deferred: BeforeInstallPromptEvent | null = null;
let armed = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of [...listeners]) listener();
}

function onBeforeInstallPrompt(event: Event) {
  // Stop the browser's own mini-infobar; the menu entry is the one offer.
  event.preventDefault();
  deferred = event as BeforeInstallPromptEvent;
  emit();
}

function onInstalled() {
  deferred = null;
  emit();
}

/** Start listening. Idempotent; call it as early as a client component can. */
export function armInstallPrompt(): void {
  if (armed || typeof window === "undefined") return;
  armed = true;
  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  window.addEventListener("appinstalled", onInstalled);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Safety net for a tree that does not mount PwaRegister (tests, stories).
  armInstallPrompt();
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => deferred;
const getServerSnapshot = () => null;

export function useInstallPrompt(): {
  prompt: BeforeInstallPromptEvent | null;
  clear: () => void;
} {
  const prompt = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const clear = useCallback(() => {
    deferred = null;
    emit();
  }, []);
  return { prompt, clear };
}

/** Test seam: forget the shared state and the window listeners between cases. */
export function resetInstallPromptForTests() {
  if (typeof window !== "undefined") {
    window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.removeEventListener("appinstalled", onInstalled);
  }
  deferred = null;
  armed = false;
  listeners.clear();
}
