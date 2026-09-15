/**
 * What actually happened to an outbound email, and the one place the app
 * decides what to tell a person about it.
 *
 * Exists because of a real support message (8 Sep 2026): a new spotter pressed
 * "Resend verification" again and again, saw "Email sent" every time, and never
 * received anything. `sendEmail()` returns `{ ok: true, skipped: true }` when
 * the provider is not configured and `{ ok: false }` when SendGrid rejects a
 * message, and every caller read only `ok` (or nothing at all), so the endpoint
 * answered 200 and the UI said "sent" for a message that never left.
 *
 * Nothing in here touches the network or the database, so client components
 * can import the copy and the status codes without dragging the sender into
 * the browser bundle.
 */

export interface SendEmailResult {
  /**
   * True when the provider accepted the message, and ALSO when nothing was
   * sent because the provider is not configured (see `skipped`). The second
   * case is deliberate: a missing API key must never roll back the caller's
   * own transaction (the account was still created, the token still exists).
   * It means `ok` alone cannot tell you whether a person will receive
   * anything; use `sendOutcome()` / `wasSent()` for that.
   */
  ok: boolean;
  /** SendGrid's `x-message-id`, when the provider accepted the message. */
  messageId?: string;
  /** True when nothing was sent because SENDGRID_API_KEY / EMAIL_FROM_ADDRESS are unset. */
  skipped?: boolean;
  /** Why nothing was delivered, for logs and the admin diagnostics page. */
  error?: string;
}

export type SendOutcome = "sent" | "not-configured" | "failed";

export function sendOutcome(result: SendEmailResult): SendOutcome {
  if (!result.ok) return "failed";
  if (result.skipped) return "not-configured";
  return "sent";
}

/** True only when the provider accepted the message for delivery. */
export function wasSent(result: SendEmailResult): boolean {
  return sendOutcome(result) === "sent";
}

export const SUPPORT_EMAIL = "hello@pebl-cic.co.uk";

/**
 * Shown when a verification or reset email could not be sent. It names the
 * way out (a human) rather than "try again later", because neither reason this
 * fires (provider unconfigured, provider rejecting the sender) is something a
 * retry fixes.
 */
export const EMAIL_UNAVAILABLE_MESSAGE = `We could not send that email just now. Email ${SUPPORT_EMAIL} from your account address and we will sort it out by hand.`;

/** Machine-readable code on the 503 body, so clients can branch on it. */
export const EMAIL_UNAVAILABLE_CODE = "email_unavailable";

/**
 * HTTP status for an endpoint whose whole job was to send one email: 200 only
 * when the message actually left, 503 otherwise. Service Unavailable is the
 * honest code (the service the endpoint fronts is unavailable) and the clients
 * treat it as "tell the person how to get help", not as "retry".
 */
export function resendStatusFor(outcome: SendOutcome): 200 | 503 {
  return outcome === "sent" ? 200 : 503;
}
