"use client";

import type { BeforeInstallPromptEvent } from "@/lib/useInstallPrompt";

/**
 * The "Install app" button. The deferred prompt it needs is captured by
 * `src/lib/useInstallPrompt.ts`, which `PwaRegister` arms on every page, so the
 * side menu that shows this can load late without losing the browser's event.
 */
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
