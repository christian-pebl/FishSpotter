"use client";

import type { ReactNode } from "react";
import { SUPPORT_EMAIL } from "@/lib/email/outcome";

export type VerificationSendStatus =
  | "idle"
  | "sending"
  | "sent"
  | "rate-limited"
  | "unavailable"
  | "error";

/**
 * Maps the resend endpoint's answer onto a status the help line can explain.
 * 503 is the endpoint saying "nothing left" (provider unconfigured or
 * rejecting), which is a different sentence from a network blip.
 */
export function verificationStatusFromResponse(res: Response): VerificationSendStatus {
  if (res.ok) return "sent";
  if (res.status === 429) return "rate-limited";
  if (res.status === 503) return "unavailable";
  return "error";
}

/**
 * The line under every "resend verification email" button. One component so
 * the three places that offer a resend (the feed banner, the account page and
 * the end-of-feed card) tell the same truth: after a real send, where to look
 * if it has not arrived; after a failed one, who to email. Written for the
 * spotter who pressed resend for days (8 Sep 2026) and was told "Email sent"
 * every time, with no next step.
 */
export function VerificationHelp({
  status,
  showIdleHint = true,
  className = "",
}: {
  status: VerificationSendStatus;
  /** The "not arrived? check spam" line before anything has been pressed. Off in tight spaces. */
  showIdleHint?: boolean;
  className?: string;
}) {
  const mail = (
    <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium underline hover:text-navy-900">
      {SUPPORT_EMAIL}
    </a>
  );

  let body: ReactNode = null;
  let alert = false;
  switch (status) {
    case "sent":
      body = (
        <>
          Sent. Give it a minute and check your spam folder. Still nothing? Email {mail} from
          this address and we will verify you by hand.
        </>
      );
      break;
    case "unavailable":
      alert = true;
      body = (
        <>
          We could not send the email just now. Email {mail} from your account address and we
          will verify you by hand.
        </>
      );
      break;
    case "rate-limited":
      body = (
        <>
          You have asked a few times in a row. If nothing has arrived, check spam, then email{" "}
          {mail} and we will verify you by hand.
        </>
      );
      break;
    case "error":
      alert = true;
      body = <>Something went wrong sending it. Try once more, or email {mail}.</>;
      break;
    case "sending":
      break;
    default:
      body = showIdleHint ? (
        <>
          Not arrived? Check your spam folder, or email {mail} from this address and we will
          verify you by hand.
        </>
      ) : null;
  }

  if (!body) return null;
  return (
    <p
      role={alert ? "alert" : undefined}
      className={`text-xs leading-5 text-navy-900/72 ${className}`}
    >
      {body}
    </p>
  );
}
