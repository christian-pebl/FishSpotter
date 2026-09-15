// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The forgot-password endpoint has two promises that pull in opposite
 * directions: never reveal whether an address has an account, and never tell
 * a person a reset link is on its way when none can be sent. The contract
 * that keeps both: an UNCONFIGURED provider is a 503 for every address,
 * before any lookup (the same answer for everyone leaks nothing); a per-send
 * provider failure for a real account is still the generic 200, and logged.
 */

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  passwordResetToken: { create: vi.fn() },
}));
const rateLimit = vi.hoisted(() => ({ checkAuthRateLimit: vi.fn() }));
const sender = vi.hoisted(() => ({ sendEmail: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/rate-limit", () => rateLimit);
vi.mock("@/lib/email/send", () => sender);

import { POST } from "./route";
import { EMAIL_UNAVAILABLE_CODE, SUPPORT_EMAIL } from "@/lib/email/outcome";

const ORIGIN = "https://www.fishspotter.app";

function post(email: string): Request {
  return new Request(`${ORIGIN}/api/auth/forgot`, {
    method: "POST",
    headers: {
      host: "www.fishspotter.app",
      origin: ORIGIN,
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.5",
    },
    body: JSON.stringify({ email }),
  });
}

const USER = { id: "u1", email: "spotter@example.com", displayName: "Sam", name: null };

describe("POST /api/auth/forgot", () => {
  beforeEach(() => {
    vi.stubEnv("SENDGRID_API_KEY", "SG.test-key");
    vi.stubEnv("EMAIL_FROM_ADDRESS", "noreply@fishspotter.app");
    rateLimit.checkAuthRateLimit.mockResolvedValue(true);
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.passwordResetToken.create.mockResolvedValue({});
    sender.sendEmail.mockResolvedValue({ ok: true, messageId: "m1" });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("answers 503 for every address when the provider is not configured, before any lookup", async () => {
    vi.stubEnv("EMAIL_FROM_ADDRESS", "");
    for (const email of ["nobody@example.com", "spotter@example.com"]) {
      const res = await POST(post(email));
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.code).toBe(EMAIL_UNAVAILABLE_CODE);
      expect(body.error).toContain(SUPPORT_EMAIL);
    }
    // Nothing that could differ per address ran, so nothing leaked.
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(rateLimit.checkAuthRateLimit).not.toHaveBeenCalled();
    expect(sender.sendEmail).not.toHaveBeenCalled();
  });

  it("answers the generic 200 for an unknown address, sending nothing", async () => {
    const res = await POST(post("nobody@example.com"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
    expect(sender.sendEmail).not.toHaveBeenCalled();
  });

  it("mints a token and sends the reset link for a real account", async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER);
    const res = await POST(post("Spotter@Example.com"));
    expect(res.status).toBe(200);
    expect(prismaMock.passwordResetToken.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.passwordResetToken.create.mock.calls[0][0].data.userId).toBe("u1");
    expect(sender.sendEmail).toHaveBeenCalledTimes(1);
    // Lower-cased before lookup and send, so mixed-case input reaches the same account.
    expect(sender.sendEmail.mock.calls[0][0].to).toBe("spotter@example.com");
  });

  it("keeps the generic 200 when the provider refuses a real account's message, and logs it", async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER);
    sender.sendEmail.mockResolvedValue({ ok: false, error: "SendGrid 403: ..." });
    const res = await POST(post("spotter@example.com"));
    // A 503 only for existing addresses would be an enumeration oracle.
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(console.error).toHaveBeenCalled();
  });

  it("rate limits by address once the provider is configured", async () => {
    rateLimit.checkAuthRateLimit.mockResolvedValue(false);
    const res = await POST(post("spotter@example.com"));
    expect(res.status).toBe(429);
    expect(rateLimit.checkAuthRateLimit).toHaveBeenCalledWith("forgot:203.0.113.5:spotter@example.com");
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });
});
