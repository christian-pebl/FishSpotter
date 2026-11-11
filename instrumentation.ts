import { reportEnvAtBoot } from "@/lib/env";

// Next.js instrumentation hook. `register()` runs once when the server process
// boots. We gate on NEXT_RUNTIME === "nodejs" so the check runs only in the
// Node server runtime: NOT on the Edge runtime (which has a different, smaller
// env surface) and NOT during `next build`'s static analysis (where this file
// may be evaluated for collection but NEXT_RUNTIME is unset).
//
// The check LOGS a missing variable rather than throwing: Next 16 re-raises a
// register() error on every request, so throwing would turn the whole site
// into 500s (see reportEnvAtBoot in src/lib/env.ts). Since Next 15 the hook is
// always on; the old `experimental.instrumentationHook` flag is gone. Sentry
// was removed on 11 Nov 2026 (it never had a DSN, so it never sent anything).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    reportEnvAtBoot();
  }
}
