import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "./send";
import { sendOutcome } from "./outcome";
import { VerificationEmail } from "./templates/VerificationEmail";

/**
 * The sender is exercised for real (React Email render included) against a
 * stubbed `fetch`, because what matters is the CONTRACT of its result: a
 * caller that tells a person "check your inbox" reads it, so "sent" has to
 * mean SendGrid accepted the message, and every other case has to be
 * distinguishable and never thrown. The 8 Sep 2026 support message was a
 * spotter who saw "Email sent" for messages that never left.
 */

const EMAIL = VerificationEmail({
  displayName: "Test Spotter",
  verifyUrl: "https://www.fishspotter.app/auth/verify?token=abc123",
});

function configured() {
  vi.stubEnv("SENDGRID_API_KEY", "SG.test-key");
  vi.stubEnv("EMAIL_FROM_ADDRESS", "noreply@fishspotter.app");
  vi.stubEnv("EMAIL_FROM_NAME", "FishSpotter");
  vi.stubEnv("EMAIL_REPLY_TO", "hello@pebl-cic.co.uk");
}

describe("sendEmail", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("EMAIL_PREVIEW_CATCHALL", "");
    // The sender logs every non-delivery at error level; keep the test output quiet.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends nothing, says which vars are missing, and logs an error when unconfigured", async () => {
    vi.stubEnv("SENDGRID_API_KEY", "");
    vi.stubEnv("EMAIL_FROM_ADDRESS", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendEmail({ to: "spotter@example.com", subject: "Verify", react: EMAIL });

    expect(fetchMock).not.toHaveBeenCalled();
    // `ok` stays true so the caller's own transaction is never rolled back...
    expect(result.ok).toBe(true);
    // ...but the result is unmistakably "nothing was sent".
    expect(result.skipped).toBe(true);
    expect(result.error).toContain("SENDGRID_API_KEY");
    expect(result.error).toContain("EMAIL_FROM_ADDRESS");
    expect(sendOutcome(result)).toBe("not-configured");
    expect(console.error).toHaveBeenCalled();
  });

  it("treats a set key with no from address as unconfigured too", async () => {
    vi.stubEnv("SENDGRID_API_KEY", "SG.test-key");
    vi.stubEnv("EMAIL_FROM_ADDRESS", "   ");
    vi.stubGlobal("fetch", vi.fn());

    const result = await sendEmail({ to: "spotter@example.com", subject: "Verify", react: EMAIL });

    expect(sendOutcome(result)).toBe("not-configured");
    expect(result.error).toContain("EMAIL_FROM_ADDRESS");
    expect(result.error).not.toContain("SENDGRID_API_KEY");
  });

  it("posts to SendGrid and reports the message id when it accepts", async () => {
    configured();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("", { status: 202, headers: { "x-message-id": "msg-123" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendEmail({ to: "spotter@example.com", subject: "Verify", react: EMAIL });

    expect(result).toEqual({ ok: true, messageId: "msg-123" });
    expect(sendOutcome(result)).toBe("sent");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.sendgrid.com/v3/mail/send");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer SG.test-key");
    const body = JSON.parse(init.body as string);
    expect(body.personalizations[0].to[0].email).toBe("spotter@example.com");
    expect(body.from).toEqual({ email: "noreply@fishspotter.app", name: "FishSpotter" });
    expect(body.reply_to).toEqual({ email: "hello@pebl-cic.co.uk" });
    // SendGrid insists on ascending MIME order: text/plain before text/html.
    expect(body.content.map((c: { type: string }) => c.type)).toEqual(["text/plain", "text/html"]);
    expect(body.content[1].value).toContain("auth/verify?token=abc123");
    expect(body.content[0].value).toContain("auth/verify?token=abc123");
  });

  it("reports a rejection with SendGrid's own status and reason, and never throws", async () => {
    configured();
    const sendgridBody = JSON.stringify({
      errors: [{ message: "The from address does not match a verified Sender Identity." }],
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(sendgridBody, { status: 403 })));

    const result = await sendEmail({ to: "spotter@example.com", subject: "Verify", react: EMAIL });

    expect(result.ok).toBe(false);
    expect(result.skipped).toBeUndefined();
    expect(result.error).toMatch(/^SendGrid 403/);
    expect(result.error).toContain("verified Sender Identity");
    expect(sendOutcome(result)).toBe("failed");
  });

  it("turns a network failure into a failed result rather than an exception", async () => {
    configured();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND api.sendgrid.com")),
    );

    const result = await sendEmail({ to: "spotter@example.com", subject: "Verify", react: EMAIL });

    expect(result).toEqual({ ok: false, error: "getaddrinfo ENOTFOUND api.sendgrid.com" });
    expect(sendOutcome(result)).toBe("failed");
  });

  it("redirects preview-deploy mail to the catch-all and leaves production mail alone", async () => {
    configured();
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("EMAIL_PREVIEW_CATCHALL", "qa@example.com");
    await sendEmail({ to: "spotter@example.com", subject: "Verify", react: EMAIL });
    const preview = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(preview.personalizations[0].to[0].email).toBe("qa@example.com");

    vi.stubEnv("VERCEL_ENV", "production");
    await sendEmail({ to: "spotter@example.com", subject: "Verify", react: EMAIL });
    const production = JSON.parse((fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string);
    expect(production.personalizations[0].to[0].email).toBe("spotter@example.com");
  });
});
