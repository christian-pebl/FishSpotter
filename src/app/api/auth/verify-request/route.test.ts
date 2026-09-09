// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The resend endpoint's contract, exercised through the real handler with
 * its collaborators mocked: 200 ONLY when the provider accepted the message,
 * 503 with a human way out otherwise. This is the endpoint that answered 200
 * for messages that never left (8 Sep 2026), so the contract is pinned here
 * rather than left to the callers' good intentions.
 */

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
const prismaMock = vi.hoisted(() => ({ user: { findUnique: vi.fn() } }));
const rateLimit = vi.hoisted(() => ({ checkAuthRateLimit: vi.fn() }));
const dispatch = vi.hoisted(() => ({ sendVerificationEmail: vi.fn() }));

vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => session.current) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/rate-limit", () => rateLimit);
vi.mock("@/lib/email/dispatch", () => dispatch);

import { POST } from "./route";
import { EMAIL_UNAVAILABLE_CODE, SUPPORT_EMAIL } from "@/lib/email/outcome";

const ORIGIN = "https://www.fishspotter.app";

function post(origin = ORIGIN): Request {
  return new Request(`${ORIGIN}/api/auth/verify-request`, {
    method: "POST",
    headers: { host: "www.fishspotter.app", origin },
  });
}

const USER = {
  id: "u1",
  email: "spotter@example.com",
  displayName: "Sam",
  name: null,
  emailVerified: null,
};

describe("POST /api/auth/verify-request", () => {
  beforeEach(() => {
    vi.stubEnv("SENDGRID_API_KEY", "SG.test-key");
    vi.stubEnv("EMAIL_FROM_ADDRESS", "noreply@fishspotter.app");
    session.current = { user: { id: "u1" } };
    prismaMock.user.findUnique.mockResolvedValue(USER);
    rateLimit.checkAuthRateLimit.mockResolvedValue(true);
    dispatch.sendVerificationEmail.mockResolvedValue({ ok: true, messageId: "m1" });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("answers 200 when, and only when, the provider accepted the message", async () => {
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(dispatch.sendVerificationEmail).toHaveBeenCalledWith("u1", "spotter@example.com", "Sam");
  });

  it("answers 503 with a human way out when the provider is not configured, without spending the rate limit", async () => {
    vi.stubEnv("SENDGRID_API_KEY", "");
    const res = await POST(post());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe(EMAIL_UNAVAILABLE_CODE);
    expect(body.error).toContain(SUPPORT_EMAIL);
    // Five honest 503s must never turn into a 429 that hides the reason.
    expect(rateLimit.checkAuthRateLimit).not.toHaveBeenCalled();
    expect(dispatch.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("answers 503 when SendGrid refuses the message", async () => {
    dispatch.sendVerificationEmail.mockResolvedValue({
      ok: false,
      error: "SendGrid 403: The from address does not match a verified Sender Identity.",
    });
    const res = await POST(post());
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe(EMAIL_UNAVAILABLE_CODE);
  });

  it("answers 503 when the dispatcher skipped the send, even though its ok flag is true", async () => {
    // The exact result shape that used to be reported as "Email sent".
    dispatch.sendVerificationEmail.mockResolvedValue({
      ok: true,
      skipped: true,
      error: "Email is not configured (SENDGRID_API_KEY not set)",
    });
    const res = await POST(post());
    expect(res.status).toBe(503);
  });

  it("sends nothing to an address that is already verified", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...USER, emailVerified: new Date() });
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, already: true });
    expect(dispatch.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("rate limits repeated requests once the provider is configured", async () => {
    rateLimit.checkAuthRateLimit.mockResolvedValue(false);
    const res = await POST(post());
    expect(res.status).toBe(429);
    expect(rateLimit.checkAuthRateLimit).toHaveBeenCalledWith("verify-resend:u1");
    expect(dispatch.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("rejects cross-origin and anonymous requests before doing anything", async () => {
    expect((await POST(post("https://evil.example.com"))).status).toBe(403);
    session.current = null;
    expect((await POST(post())).status).toBe(401);
    expect(dispatch.sendVerificationEmail).not.toHaveBeenCalled();
  });
});
