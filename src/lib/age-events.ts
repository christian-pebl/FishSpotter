// Window events for the age question and the parent requests, so any part of
// the page (the prize card, a comment box, the save prompt) can open the one
// global dialog for each without prop-drilling. Both dialogs are mounted once,
// in the root layout (src/app/layout.tsx).

import type { ParentalConsentPurpose } from "@/lib/parental-consent-shared";

/**
 * sessionStorage key for the age band answered in this tab, shared by the
 * guest start screen and the signup form. An under-13 answer is held so a
 * child cannot go back and pick again (the FTC's neutral age screen).
 */
export const TAB_AGE_KEY = "fishspotter:ageBand";

/** Open AgeCheck even though the session already knows the band is unknown. */
export const AGE_CHECK_REQUEST_EVENT = "fishspotter:age-check-request";

/** Fired once a band is saved. Detail: AgeDeclaredDetail. */
export const AGE_DECLARED_EVENT = "fishspotter:age-declared";

export interface AgeDeclaredDetail {
  ageBand: string;
  /** An under-13's own email address was removed from the account. */
  removedEmail: boolean;
}

/** Open the "ask a parent or carer" dialog. Detail: ParentRequestDetail. */
export const PARENT_REQUEST_EVENT = "fishspotter:parent-request";

export interface ParentRequestDetail {
  purpose: ParentalConsentPurpose;
}

/** Fired after a request is made. Detail: ParentRequestedDetail. */
export const PARENT_REQUESTED_EVENT = "fishspotter:parent-requested";

export interface ParentRequestedDetail {
  purpose: ParentalConsentPurpose;
  emailSent: boolean;
}

export function requestAgeCheck(): void {
  window.dispatchEvent(new CustomEvent(AGE_CHECK_REQUEST_EVENT));
}

export function requestParentConsent(purpose: ParentalConsentPurpose): void {
  window.dispatchEvent(
    new CustomEvent<ParentRequestDetail>(PARENT_REQUEST_EVENT, { detail: { purpose } }),
  );
}
