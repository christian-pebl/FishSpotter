import { Button, Text } from "@react-email/components";
import { EmailLayout } from "./_Layout";

const P = { fontSize: 14, lineHeight: 1.55, color: "#17252A" } as const;
const SMALL = { fontSize: 12, lineHeight: 1.5, color: "#5A6E74" } as const;

/** The link a parent asked for on /parent. */
export function ParentManageLinkEmail({
  manageUrl,
  expiresIn,
}: {
  manageUrl: string;
  expiresIn: string;
}) {
  return (
    <EmailLayout preview="Your link to manage your child's FishSpotter account">
      <Text style={{ fontSize: 22, fontWeight: 700, color: "#17252A", marginTop: 16 }}>
        Manage your child&apos;s account
      </Text>
      <Text style={P}>Hello,</Text>
      <Text style={P}>
        You asked for a link to manage the FishSpotter accounts linked to this email address. From
        there you can sign your child in on this device, see and download what we hold, withdraw
        your agreement, or delete their account.
      </Text>
      <Button
        href={manageUrl}
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
        Open the parent page
      </Button>
      <Text style={{ ...SMALL, marginTop: 16 }}>Or paste this link into your browser: {manageUrl}</Text>
      <Text style={SMALL}>
        This link works for {expiresIn}. If you did not ask for it, you can ignore this email.
      </Text>
    </EmailLayout>
  );
}
