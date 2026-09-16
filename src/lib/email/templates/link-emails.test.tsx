// @vitest-environment node
import { describe, expect, it } from "vitest";
import { render } from "@react-email/components";
import { PasswordResetEmail } from "./PasswordResetEmail";
import { VerificationEmail } from "./VerificationEmail";
import {
  CATCH_UP_SETUP_INTRO,
  CATCH_UP_VERIFY_INTRO,
} from "@/lib/email/verification-backlog";

const text = (el: React.ReactElement) => render(el, { plainText: true });

describe("PasswordResetEmail", () => {
  it("keeps the reset wording and the one-hour footer by default", async () => {
    const out = await text(PasswordResetEmail({ displayName: "Sam", resetUrl: "https://x/r" }));
    expect(out).toContain("Reset your password");
    expect(out).toContain("We received a request to reset the password");
    expect(out).toContain("expires in 1 hour");
  });

  it("never tells a guest setting up an account that they asked for a reset", async () => {
    const out = await text(
      PasswordResetEmail({ displayName: "Sam", resetUrl: "https://x/r", variant: "setup" }),
    );
    expect(out).toContain("Finish setting up your account");
    expect(out).not.toMatch(/request to reset/i);
    expect(out).toContain("Choosing one also confirms your email address.");
  });

  it("drops the confirmation promise where setting a password does not confirm", async () => {
    const out = await text(
      PasswordResetEmail({
        displayName: "Sam",
        resetUrl: "https://x/r",
        variant: "setup",
        confirmsEmail: false,
      }),
    );
    expect(out).not.toMatch(/confirms your email/i);
  });

  it("carries the catch-up intro and its own lifetime", async () => {
    const out = await text(
      PasswordResetEmail({
        displayName: "Sam",
        resetUrl: "https://x/r",
        variant: "setup",
        intro: CATCH_UP_SETUP_INTRO,
        expiresIn: "3 days",
      }),
    );
    expect(out).toContain("Hi Sam,");
    expect(out).toContain("Sorry about that.");
    expect(out).toContain("expires in 3 days");
  });
});

describe("VerificationEmail", () => {
  it("keeps the welcome for a new signup", async () => {
    const out = await text(VerificationEmail({ displayName: "Sam", verifyUrl: "https://x/v" }));
    expect(out).toContain("Welcome, Sam.");
    expect(out).toContain("expires in 24 hours");
  });

  it("greets rather than welcomes on a catch-up send, and says why it came", async () => {
    const out = await text(
      VerificationEmail({
        displayName: "Sam",
        verifyUrl: "https://x/v",
        intro: CATCH_UP_VERIFY_INTRO,
        expiresIn: "7 days",
      }),
    );
    expect(out).toContain("Hi Sam,");
    expect(out).not.toContain("Welcome");
    expect(out).toContain("weren't being sent");
    expect(out).toContain("expires in 7 days");
  });
});
