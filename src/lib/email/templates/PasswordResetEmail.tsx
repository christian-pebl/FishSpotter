import { Button, Text } from "@react-email/components";
import { EmailLayout } from "./_Layout";

export function PasswordResetEmail({
  displayName,
  resetUrl,
}: {
  displayName: string;
  resetUrl: string;
}) {
  return (
    <EmailLayout preview="Reset your PEBL FishSpotter password">
      <Text style={{ fontSize: 22, fontWeight: 700, color: "#17252A", marginTop: 16 }}>
        Reset your password
      </Text>
      <Text style={{ fontSize: 14, lineHeight: 1.55, color: "#17252A" }}>
        Hi {displayName}, we received a request to reset the password on your PEBL FishSpotter account. Tap the button below to set a new one.
      </Text>
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
        Set a new password
      </Button>
      <Text style={{ fontSize: 12, lineHeight: 1.5, color: "#5A6E74", marginTop: 16 }}>
        Or paste this URL into your browser: {resetUrl}
      </Text>
      <Text style={{ fontSize: 12, color: "#5A6E74" }}>
        This link expires in 1 hour and can only be used once. If you didn&apos;t request a reset, ignore this email and your password stays the same.
      </Text>
    </EmailLayout>
  );
}
