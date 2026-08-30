"use client";

import { useCallback, useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

/**
 * The browser's deferred install prompt, if it ever offered one.
 *
 * The state is a hook rather than local to the button because the caller has to
 * know too: the button renders null far more often than not (iOS Safari never
 * fires the event, and neither does an already-installed app), and the side
 * menu's section wrapper drawn around nothing is a stray divider with padding
 * under it. One owner, so the menu and the button can never disagree about
 * whether there is anything to show.
 */
export function useInstallPrompt(): {
  prompt: BeforeInstallPromptEvent | null;
  clear: () => void;
} {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const clear = useCallback(() => setInstallPrompt(null), []);

  return { prompt: installPrompt, clear };
}

export function PwaInstallButton({
  prompt,
  onDone,
}: {
  prompt: BeforeInstallPromptEvent;
  onDone: () => void;
}) {
  return (
    <button
      type="button"
      onClick={async () => {
        await prompt.prompt();
        await prompt.userChoice.catch(() => null);
        onDone();
      }}
      className="pebl-button-secondary rounded-full px-3 py-1.5 text-sm font-medium"
    >
      Install app
    </button>
  );
}
