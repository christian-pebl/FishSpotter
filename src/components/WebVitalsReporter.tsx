"use client";

import { useEffect } from "react";

const SAMPLE_RATE = 0.1; // 10% of sessions report to /api/vitals.

/**
 * Web-vitals sampler (S4-16). Loads `web-vitals` dynamically so it
 * doesn't bloat the initial JS bundle. Reports LCP / CLS / INP for
 * a 10% slice of sessions. The receiving route writes nothing to
 * the DB yet — a future ticket can persist to a `Vital` table.
 */
export function WebVitalsReporter() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (Math.random() > SAMPLE_RATE) return;

    let cancelled = false;
    import("web-vitals")
      .then((wv) => {
        if (cancelled) return;
        const report = (metric: { name: string; value: number; id: string }) => {
          try {
            const body = JSON.stringify({
              name: metric.name,
              value: metric.value,
              id: metric.id,
              path: window.location.pathname,
              ua: navigator.userAgent.slice(0, 200),
            });
            const url = "/api/vitals";
            if ("sendBeacon" in navigator) {
              navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
            } else {
              fetch(url, {
                method: "POST",
                body,
                headers: { "Content-Type": "application/json" },
                keepalive: true,
              }).catch(() => {});
            }
          } catch {
            // Best-effort. A blocked beacon should never affect the user.
          }
        };
        wv.onLCP(report);
        wv.onCLS(report);
        wv.onINP(report);
      })
      .catch(() => {
        // web-vitals import failed; silently noop.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
