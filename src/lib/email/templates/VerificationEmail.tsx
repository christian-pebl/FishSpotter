import { Button, Text } from "@react-email/components";
import { EmailLayout } from "./_Layout";

export function VerificationEmail({
  displayName,
  verifyUrl,
}: {
  displayName: string;
  verifyUrl: string;
}) {
  return (
    <EmailLayout preview="Verify your PEBL FishSpotter account">
      <Text style={{ fontSize: 22, fontWeight: 700, color: "#17252A", marginTop: 16 }}>
        Welcome, {displayName}.
      </Text>
      <Text style={{ fontSize: 14, lineHeight: 1.55, color: "#17252A" }}>
        One more step before your spotter profile is fully set up: confirm this is your email address.
      </Text>
      <Button
        href={verifyUrl}
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
        Verify email
      </Button>
      <Text style={{ fontSize: 12, lineHeight: 1.5, color: "#5A6E74", marginTop: 16 }}>
        Or paste this URL into your browser: {verifyUrl}
      </Text>
      <Text style={{ fontSize: 12, color: "#5A6E74" }}>
        This link expires in 24 hours. If you didn&apos;t create a PEBL FishSpotter account, you can safely ignore this email.
      </Text>
    </EmailLayout>
  );
}
