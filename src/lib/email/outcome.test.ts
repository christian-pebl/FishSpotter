import { describe, expect, it } from "vitest";
import {
  EMAIL_UNAVAILABLE_MESSAGE,
  SUPPORT_EMAIL,
  resendStatusFor,
  sendOutcome,
  wasSent,
} from "./outcome";

describe("sendOutcome", () => {
  it("calls a provider-accepted message sent", () => {
    expect(sendOutcome({ ok: true, messageId: "m1" })).toBe("sent");
    expect(sendOutcome({ ok: true })).toBe("sent");
    expect(wasSent({ ok: true })).toBe(true);
  });

  it("does not let an unconfigured skip pass as sent, even though ok is true", () => {
    // This is the exact shape that produced "Email sent" for messages that never left.
    const skipped = { ok: true, skipped: true, error: "Email is not configured" };
    expect(sendOutcome(skipped)).toBe("not-configured");
    expect(wasSent(skipped)).toBe(false);
  });

  it("calls a provider rejection or a thrown send failed", () => {
    expect(sendOutcome({ ok: false, error: "SendGrid 403: ..." })).toBe("failed");
    expect(wasSent({ ok: false })).toBe(false);
  });
});

describe("resendStatusFor", () => {
  it("answers 200 only when the message actually left", () => {
    expect(resendStatusFor("sent")).toBe(200);
    expect(resendStatusFor("not-configured")).toBe(503);
    expect(resendStatusFor("failed")).toBe(503);
  });
});

describe("the message a person sees when nothing could be sent", () => {
  it("names a human way out rather than asking them to retry", () => {
    expect(EMAIL_UNAVAILABLE_MESSAGE).toContain(SUPPORT_EMAIL);
    expect(EMAIL_UNAVAILABLE_MESSAGE.toLowerCase()).not.toContain("try again");
  });
});
