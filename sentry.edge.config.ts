// Sentry Edge-runtime init (imported by instrumentation.ts when
// NEXT_RUNTIME === "edge", e.g. middleware and edge routes). Sentry stays
// INERT until SENTRY_DSN is set: with the DSN unset, `dsn` is undefined and
// `enabled` is false, so init() is a no-op. No Sentry account or env wiring
// is required to land this.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: 0.1,
});
