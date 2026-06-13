import * as Sentry from "@sentry/nextjs";
import { validateEnv } from "@/lib/env";

// Next.js instrumentation hook. `register()` runs once when the server process
// boots. We gate on NEXT_RUNTIME === "nodejs" so validation runs only in the
// Node server runtime: NOT on the Edge runtime (which has a different, smaller
// env surface) and NOT during `next build`'s static analysis (where this file
// may be evaluated for collection but NEXT_RUNTIME is unset). This keeps the
// build green while still failing fast at actual server startup if a required
// env var is missing or invalid.
//
// NB: in Next 14.2.x the instrumentation hook only fires when
// `experimental.instrumentationHook: true` is set in next.config.mjs.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    validateEnv();
    // Load the Node-runtime Sentry init. Dynamic import keeps the edge bundle
    // free of Node-only code, per the standard @sentry/nextjs v8 pattern. The
    // config self-no-ops when SENTRY_DSN is unset, so this is safe to run
    // unconditionally here (validateEnv has already gated this branch).
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// App-Router server-component / route error capture hook (Next 14.2 +
// @sentry/nextjs v8). Next calls onRequestError for unhandled server errors;
// captureRequestError forwards them to Sentry, which no-ops while the DSN is
// unset (init() above was never enabled).
export const onRequestError = Sentry.captureRequestError;
