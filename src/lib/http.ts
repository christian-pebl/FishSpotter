/**
 * Timeout-aware `fetch` wrapper (security/robustness audit, 22 Jun 2026).
 *
 * Plain `fetch()` has NO default timeout: a hung or slow upstream (OBIS, GBIF,
 * iNaturalist, SendGrid, Gemini, image downloads) keeps the connection — and on
 * a serverless function, the whole invocation — open until the platform kills
 * it. Under load that is a self-inflicted denial of service. Every outbound
 * call in the app must go through here so it fails fast with a bounded budget.
 *
 * The thrown error on timeout is a DOMException with `name === "TimeoutError"`,
 * which existing per-call try/catch and retry loops already treat as a
 * transient failure.
 */

/** Default budget for a single outbound request. */
export const DEFAULT_TIMEOUT_MS = 10_000;

export async function fetchWithTimeout(
  url: string | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);

  // Compose with a caller-supplied signal when present so an upstream abort
  // (e.g. the client disconnecting) still cancels the request, while the
  // timeout remains the backstop. `AbortSignal.any` is available on Node 20+
  // (Vercel's runtime); fall back to the timeout signal alone if absent.
  const signal =
    init.signal && typeof AbortSignal.any === "function"
      ? AbortSignal.any([init.signal, timeoutSignal])
      : (init.signal ?? timeoutSignal);

  return fetch(url, { ...init, signal });
}

/** True when an error was thrown by an `AbortSignal.timeout`. */
export function isTimeoutError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "TimeoutError";
}
