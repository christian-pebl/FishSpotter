import { Button, Text } from "@react-email/components";
import { EmailLayout } from "./_Layout";

/**
 * One template, two jobs, because both are a one-time link to
 * /auth/reset/<token>:
 *
 *   reset  "Forgot password" (POST /api/auth/forgot).
 *   setup  A guest who saved their progress with an email and has never had
 *          a password (POST /api/guest/claim, and the catch-up send on
 *          /admin/email). Until 16 Sep 2026 these got the reset wording, "we
 *          received a request to reset the password", on an account that had
 *          never had one.
 *
 * Setting a password from either link also confirms the address (see
 * POST /api/auth/reset), except on the admin domain. The setup copy says so
 * when it applies, because a confirmed email is what a prize claim needs.
 */
export function PasswordResetEmail({
  displayName,
  resetUrl,
  variant = "reset",
  intro,
  expiresIn = "1 hour",
  confirmsEmail = true,
}: {
  displayName: string;
  resetUrl: string;
  variant?: "reset" | "setup";
  /** An extra paragraph after the greeting, used by the catch-up send. */
  intro?: string;
  expiresIn?: string;
  /** False for admin-domain addresses, which setting a password does not confirm. */
  confirmsEmail?: boolean;
}) {
  const setup = variant === "setup";
  const body = setup
    ? `Set a password so you can sign back in to your finds and your leaderboard spot from any device.${
        confirmsEmail ? " Choosing one also confirms your email address." : ""
      }`
    : "We received a request to reset the password on your PEBL FishSpotter account. Tap the button below to set a new one.";

  return (
    <EmailLayout
      preview={setup ? "Finish setting up your PEBL FishSpotter account" : "Reset your PEBL FishSpotter password"}
    >
      <Text style={{ fontSize: 22, fontWeight: 700, color: "#17252A", marginTop: 16 }}>
        {setup ? "Finish setting up your account" : "Reset your password"}
      </Text>
      <Text style={{ fontSize: 14, lineHeight: 1.55, color: "#17252A" }}>Hi {displayName},</Text>
      {intro ? (
        <Text style={{ fontSize: 14, lineHeight: 1.55, color: "#17252A" }}>{intro}</Text>
      ) : null}
      <Text style={{ fontSize: 14, lineHeight: 1.55, color: "#17252A" }}>{body}</Text>
      <Button
        href={resetUrl}
        style={{
          backgroundColor: "#3AAFA9",
          color: "#17252A",
          padding: "12px 20px",
          borderRadius: 9999,
          fontSize: 14,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        {setup ? "Set a password" : "Set a new password"}
      </Button>
      <Text style={{ fontSize: 12, lineHeight: 1.5, color: "#5A6E74", marginTop: 16 }}>
        Or paste this URL into your browser: {resetUrl}
      </Text>
      <Text style={{ fontSize: 12, color: "#5A6E74" }}>
        {setup
          ? `This link expires in ${expiresIn} and can only be used once. If you didn't save a PEBL FishSpotter account with this address, you can safely ignore this email.`
          : `This link expires in ${expiresIn} and can only be used once. If you didn't request a reset, ignore this email and your password stays the same.`}
      </Text>
    </EmailLayout>
  );
}
