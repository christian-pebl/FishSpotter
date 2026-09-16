import { Button, Text } from "@react-email/components";
import { EmailLayout } from "./_Layout";

const P = { fontSize: 14, lineHeight: 1.55, color: "#17252A" } as const;

/**
 * Internal note to PEBL staff that a prize was claimed. The prize rules
 * promise an email to the winner within 7 days, and until 16 Sep 2026 nothing
 * told anyone a claim had landed. Carries no contact details: the desk has
 * them, and for an under-18 the only address to use is the parent's.
 */
export function PrizeClaimStaffEmail({
  spotter,
  viaParent,
  deskUrl,
}: {
  spotter: string;
  viaParent: boolean;
  deskUrl: string;
}) {
  return (
    <EmailLayout preview={`Prize claimed by ${spotter}`}>
      <Text style={{ fontSize: 20, fontWeight: 700, color: "#17252A", marginTop: 16 }}>
        Prize claimed
      </Text>
      <Text style={P}>
        <strong>{spotter}</strong> has claimed the Seasearch guide. The prize rules promise them an
        email within 7 days asking for a UK address, and posting within 30 days of getting it.
      </Text>
      {viaParent ? (
        <Text style={P}>
          They are under 18. Write only to the parent or carer shown on the desk, never to the
          spotter, and delete the postal address within 90 days of posting.
        </Text>
      ) : null}
      <Button
        href={deskUrl}
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
        Open the prize desk
      </Button>
    </EmailLayout>
  );
}
