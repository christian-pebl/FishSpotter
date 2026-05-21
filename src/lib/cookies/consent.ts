/**
 * Cookie-consent state (S3-09). Stored in a first-party cookie
 * `pebl_consent` for 12 months. The shape is forward-compatible so a
 * later sprint can add granular toggles without breaking existing
 * cookies.
 */

import { cookies } from "next/headers";

export interface ConsentState {
  v: 1;
  ts: number;
  essential: true;
  analytics: boolean;
}

export const CONSENT_COOKIE = "pebl_consent";

export async function readConsent(): Promise<ConsentState | null> {
  const store = await cookies();
  const raw = store.get(CONSENT_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ConsentState;
    if (parsed?.v === 1) return parsed;
  } catch {
    // ignore
  }
  return null;
}
