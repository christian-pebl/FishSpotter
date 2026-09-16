/**
 * The parts of src/lib/parental-consent.ts that client components may import.
 * That module pulls in node:crypto for tokens, which must never reach a
 * browser bundle, so the shared vocabulary lives here and is re-exported.
 */

export const PARENTAL_CONSENT_PURPOSES = ["account", "prize"] as const;
export type ParentalConsentPurpose = (typeof PARENTAL_CONSENT_PURPOSES)[number];

export type ConsentState = "none" | "pending" | "granted";
export type ConsentSummary = Record<ParentalConsentPurpose, ConsentState>;

/** How long a parent has to answer, in words, for the notices. */
export const CONSENT_REQUEST_TTL_WORDS = "14 days";

export function isConsentPurpose(value: unknown): value is ParentalConsentPurpose {
  return (
    typeof value === "string" &&
    (PARENTAL_CONSENT_PURPOSES as readonly string[]).includes(value)
  );
}

/** Collapse a child's consent rows to one state per purpose. */
export function summariseConsents(
  rows: ReadonlyArray<{ purpose: string; status: string }>,
): ConsentSummary {
  const summary: ConsentSummary = { account: "none", prize: "none" };
  for (const row of rows) {
    if (!isConsentPurpose(row.purpose)) continue;
    if (row.status === "granted") summary[row.purpose] = "granted";
    else if (row.status === "pending" && summary[row.purpose] !== "granted") {
      summary[row.purpose] = "pending";
    }
  }
  return summary;
}
