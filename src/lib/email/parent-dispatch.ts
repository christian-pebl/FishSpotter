/**
 * Outbound emails to parents and carers. Same contract as ./dispatch: never
 * throws, always reports whether the message left, so a route never tells a
 * child "we've emailed your grown-up" when nothing was sent.
 */

import { SITE_URL } from "@/lib/site-url";
import { sendEmail } from "@/lib/email/send";
import type { SendEmailResult } from "@/lib/email/outcome";
import { ParentConsentRequestEmail } from "@/lib/email/templates/ParentConsentRequestEmail";
import { ParentConsentConfirmedEmail } from "@/lib/email/templates/ParentConsentConfirmedEmail";
import { ParentManageLinkEmail } from "@/lib/email/templates/ParentManageLinkEmail";
import {
  CONFIRMATION_MANAGE_TTL_WORDS,
  CONSENT_REQUEST_TTL_WORDS,
  MANAGE_TOKEN_TTL_WORDS,
  type ParentalConsentPurpose,
} from "@/lib/parental-consent";

export const parentConsentUrl = (plainToken: string) =>
  `${SITE_URL}/parent/consent/${plainToken}`;
export const parentManageUrl = (plainToken: string) => `${SITE_URL}/parent/manage/${plainToken}`;
export const PARENT_PAGE_URL = `${SITE_URL}/parent`;

async function safeSend(
  label: string,
  send: () => Promise<SendEmailResult>,
): Promise<SendEmailResult> {
  try {
    return await send();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[email] ${label} failed`, err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function sendParentConsentRequest(input: {
  to: string;
  childName: string;
  purpose: ParentalConsentPurpose;
  plainToken: string;
}): Promise<SendEmailResult> {
  return safeSend("parent consent request", () =>
    sendEmail({
      to: input.to,
      subject:
        input.purpose === "prize"
          ? `${input.childName} has won a FishSpotter prize: we need your OK`
          : `${input.childName} would like to save their FishSpotter progress`,
      react: ParentConsentRequestEmail({
        childName: input.childName,
        purpose: input.purpose,
        consentUrl: parentConsentUrl(input.plainToken),
        privacyUrl: `${SITE_URL}/privacy`,
        expiresIn: CONSENT_REQUEST_TTL_WORDS,
      }),
    }),
  );
}

export function sendParentConsentConfirmed(input: {
  to: string;
  childName: string;
  purpose: ParentalConsentPurpose;
  manageToken: string;
  grantedAt: Date;
}): Promise<SendEmailResult> {
  return safeSend("parent consent confirmation", () =>
    sendEmail({
      to: input.to,
      subject: `Confirming your agreement for ${input.childName} on FishSpotter`,
      react: ParentConsentConfirmedEmail({
        childName: input.childName,
        purpose: input.purpose,
        manageUrl: parentManageUrl(input.manageToken),
        parentPageUrl: PARENT_PAGE_URL,
        expiresIn: CONFIRMATION_MANAGE_TTL_WORDS,
        grantedOn: input.grantedAt.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "Europe/London",
        }),
      }),
    }),
  );
}

export function sendParentManageLink(input: {
  to: string;
  manageToken: string;
}): Promise<SendEmailResult> {
  return safeSend("parent manage link", () =>
    sendEmail({
      to: input.to,
      subject: "Your link to manage your child's FishSpotter account",
      react: ParentManageLinkEmail({
        manageUrl: parentManageUrl(input.manageToken),
        expiresIn: MANAGE_TOKEN_TTL_WORDS,
      }),
    }),
  );
}
