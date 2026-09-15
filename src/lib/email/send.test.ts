import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatSender, sendEmail } from "./send";
import { sendOutcome } from "./outcome";
import { VerificationEmail } from "./templates/VerificationEmail";

/**
 * The sender is exercised for real (React Email render included) against a
 * stubbed `fetch`, because what matters is the CONTRACT of its result: a
 * caller that tells a person "check your inbox" reads it, so "sent" has to
 * mean Resend accepted the message, and every other case has to be
 * distinguishable and never thrown. The 8 Sep 2026 support message was a
 * spotter who saw "Email sent" for messages that never left; the 15 Sep 2026
 * diagnosis was SendGrid refusing every one of them with a 401 nobody read.
 */

const EMAIL = VerificationEmail({
  displayName: "Test Spotter",
  verifyUrl: "https://www.fishspotter.app/auth/verify?token=abc123",
});

function configured() {
  vi.stubEnv("RESEND_API_KEY", "re_test-key");
  vi.stubEnv("EMAIL_FROM_ADDRESS", "noreply@fishspotter.app");
  vi.stubEnv("EMAIL_FROM_NAME", "FishSpotter");
  vi.stubEnv("EMAIL_REPLY_TO", "hello@pebl-cic.co.uk");
}

/** What Resend answers for a message it took: 200 and the message id. */
function accepted(id = "msg-123") {
  return new Response(JSON.stringify({ id }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
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
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM_ADDRESS", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendEmail({ to: "spotter@example.com", subject: "Verify", react: EMAIL });

    expect(fetchMock).not.toHaveBeenCalled();
    // `ok` stays true so the caller's own transaction is never rolled back...
    expect(result.ok).toBe(true);
    // ...but the result is unmistakably "nothing was sent".
    expect(result.skipped).toBe(true);
    expect(result.error).toContain("RESEND_API_KEY");
    expect(result.error).toContain("EMAIL_FROM_ADDRESS");
    expect(sendOutcome(result)).toBe("not-configured");
    expect(console.error).toHaveBeenCalled();
  });

  it("treats a set key with no from address as unconfigured too", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test-key");
    vi.stubEnv("EMAIL_FROM_ADDRESS", "   ");
    vi.stubGlobal("fetch", vi.fn());

    const result = await sendEmail({ to: "spotter@example.com", subject: "Verify", react: EMAIL });

    expect(sendOutcome(result)).toBe("not-configured");
    expect(result.error).toContain("EMAIL_FROM_ADDRESS");
    expect(result.error).not.toContain("RESEND_API_KEY");
  });

  it("posts to Resend and reports the message id when it accepts", async () => {
    configured();
    const fetchMock = vi.fn().mockResolvedValue(accepted("msg-123"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendEmail({ to: "spotter@example.com", subject: "Verify", react: EMAIL });

    expect(result).toEqual({ ok: true, messageId: "msg-123" });
    expect(sendOutcome(result)).toBe("sent");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test-key");
    const body = JSON.parse(init.body as string);
    expect(body.to).toEqual(["spotter@example.com"]);
    expect(body.from).toBe("FishSpotter <noreply@fishspotter.app>");
    expect(body.reply_to).toBe("hello@pebl-cic.co.uk");
    expect(body.subject).toBe("Verify");
    // Both bodies carry the link: html for mail clients, text for everything else.
    expect(body.html).toContain("auth/verify?token=abc123");
    expect(body.text).toContain("auth/verify?token=abc123");
  });

  it("still counts as sent when Resend's 200 carries no readable id", async () => {
    configured();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 200 })));

    const result = await sendEmail({ to: "spotter@example.com", subject: "Verify", react: EMAIL });

    expect(result).toEqual({ ok: true, messageId: undefined });
    expect(sendOutcome(result)).toBe("sent");
  });

  it("reports a rejection with Resend's own status and reason, and never throws", async () => {
    configured();
    const resendBody = JSON.stringify({
      statusCode: 403,
      name: "validation_error",
      message:
        "The fishspotter.app domain is not verified. Please, add and verify your domain on https://resend.com/domains",
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(resendBody, { status: 403 })));

    const result = await sendEmail({ to: "spotter@example.com", subject: "Verify", react: EMAIL });

    expect(result.ok).toBe(false);
    expect(result.skipped).toBeUndefined();
    expect(result.error).toMatch(/^Resend 403/);
    expect(result.error).toContain("domain is not verified");
    expect(sendOutcome(result)).toBe("failed");
  });

  it("reports an exhausted quota as failed, never as sent (the SendGrid lesson)", async () => {
    configured();
    const resendBody = JSON.stringify({
      statusCode: 429,
      name: "daily_quota_exceeded",
      message: "You have reached your daily email sending quota.",
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(resendBody, { status: 429 })));

    const result = await sendEmail({ to: "spotter@example.com", subject: "Verify", react: EMAIL });

    expect(sendOutcome(result)).toBe("failed");
    expect(result.error).toMatch(/^Resend 429/);
    expect(result.error).toContain("quota");
  });

  it("turns a network failure into a failed result rather than an exception", async () => {
    configured();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND api.resend.com")),
    );

    const result = await sendEmail({ to: "spotter@example.com", subject: "Verify", react: EMAIL });

    expect(result).toEqual({ ok: false, error: "getaddrinfo ENOTFOUND api.resend.com" });
    expect(sendOutcome(result)).toBe("failed");
  });

  it("redirects preview-deploy mail to the catch-all and leaves production mail alone", async () => {
    configured();
    const fetchMock = vi.fn().mockImplementation(async () => accepted());
    vi.stubGlobal("fetch", fetchMock);

    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("EMAIL_PREVIEW_CATCHALL", "qa@example.com");
    await sendEmail({ to: "spotter@example.com", subject: "Verify", react: EMAIL });
    const preview = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(preview.to).toEqual(["qa@example.com"]);

    vi.stubEnv("VERCEL_ENV", "production");
    await sendEmail({ to: "spotter@example.com", subject: "Verify", react: EMAIL });
    const production = JSON.parse((fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string);
    expect(production.to).toEqual(["spotter@example.com"]);
  });
});

describe("formatSender", () => {
  it("leaves a plain name bare and quotes one that carries punctuation", () => {
    expect(formatSender("FishSpotter", "noreply@fishspotter.app")).toBe(
      "FishSpotter <noreply@fishspotter.app>",
    );
    expect(formatSender("PEBL FishSpotter", "noreply@fishspotter.app")).toBe(
      "PEBL FishSpotter <noreply@fishspotter.app>",
    );
    expect(formatSender('PEBL "CIC", FishSpotter', "noreply@fishspotter.app")).toBe(
      '"PEBL CIC, FishSpotter" <noreply@fishspotter.app>',
    );
  });

  it("falls back to the bare address when the name is empty", () => {
    expect(formatSender("  ", "noreply@fishspotter.app")).toBe("noreply@fishspotter.app");
  });
});
