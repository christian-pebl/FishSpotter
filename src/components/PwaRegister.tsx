"use client";

import { useEffect } from "react";
import { armInstallPrompt } from "@/lib/useInstallPrompt";

export function PwaRegister() {
  useEffect(() => {
    // Catch the browser's one-off install offer on every page, so the side menu
    // that shows it can be loaded late (see src/lib/useInstallPrompt.ts).
    armInstallPrompt();

    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
