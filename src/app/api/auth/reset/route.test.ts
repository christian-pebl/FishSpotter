// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Setting a password from an emailed link also confirms the address, because
 * opening the link proves the person reads that inbox. Two limits are pinned
 * here: never on the admin domain (a confirmed address there is admin, see
 * src/lib/admin.ts), and never by moving a stamp that is already set
 * (/admin/email reads verification clicks off it).
 */

const prismaMock = vi.hoisted(() => ({
  passwordResetToken: { findUnique: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn(async () => "hashed-password") } }));

import { POST } from "./route";

const ORIGIN = "https://www.fishspotter.app";
const TOKEN = "a".repeat(64);

function post(body: unknown = { token: TOKEN, newPassword: "correct horse" }): Request {
  return new Request(`${ORIGIN}/api/auth/reset`, {
    method: "POST",
    headers: { host: "www.fishspotter.app", origin: ORIGIN, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const LIVE_TOKEN = {
  id: "t1",
  userId: "u1",
  consumedAt: null,
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
};

describe("POST /api/auth/reset", () => {
  beforeEach(() => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(LIVE_TOKEN);
    prismaMock.user.findUnique.mockResolvedValue({ email: "spotter@example.com", isGuest: false });
    prismaMock.user.update.mockReturnValue({ op: "set-password" });
    prismaMock.passwordResetToken.update.mockReturnValue({ op: "consume-token" });
    prismaMock.user.updateMany.mockReturnValue({ op: "confirm-email" });
    prismaMock.$transaction.mockImplementation(async (ops: unknown[]) => ops);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sets the password and confirms an unconfirmed address in one transaction", async () => {
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { passwordHash: "hashed-password" },
    });
    expect(prismaMock.$transaction).toHaveBeenCalledWith([
      { op: "set-password" },
      { op: "consume-token" },
      { op: "confirm-email" },
    ]);
  });

  it("only ever fills an empty stamp, never moves an existing one", async () => {
    await POST(post());
    const call = prismaMock.user.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: "u1", emailVerified: null });
    expect(call.data.emailVerified).toBeInstanceOf(Date);
  });

  it("never confirms an admin-domain address", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ email: "Someone@PEBL-CIC.co.uk ", isGuest: false });
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).toHaveBeenCalledWith([
      { op: "set-password" },
      { op: "consume-token" },
    ]);
  });

  it("never confirms a guest's placeholder address", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      email: "guest_x@guest.fishspotter.local",
      isGuest: true,
    });
    await POST(post());
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a used or expired link without writing anything", async () => {
    for (const row of [
      { ...LIVE_TOKEN, consumedAt: new Date() },
      { ...LIVE_TOKEN, expiresAt: new Date(Date.now() - 1000) },
      null,
    ]) {
      prismaMock.passwordResetToken.findUnique.mockResolvedValueOnce(row);
      const res = await POST(post());
      expect(res.status).toBe(410);
    }
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("rejects a short password before touching the database", async () => {
    const res = await POST(post({ token: TOKEN, newPassword: "short" }));
    expect(res.status).toBe(400);
    expect(prismaMock.passwordResetToken.findUnique).not.toHaveBeenCalled();
  });
});
