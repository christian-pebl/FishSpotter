// Sentry browser-runtime init (loaded into the client bundle by the
// @sentry/nextjs webpack plugin, which looks for this exact filename in
// Next 14.2). Sentry stays INERT until SENTRY_DSN is set: with the DSN
// unset, `dsn` is undefined and `enabled` is false, so init() is a no-op
// and nothing is sent. This lets the integration land without a Sentry
// account or any env wiring.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: 0.1,
});
