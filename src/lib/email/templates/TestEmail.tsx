import { Text } from "@react-email/components";
import { EmailLayout } from "./_Layout";

/**
 * The one email an admin can send to themselves from /admin/email. Its job is
 * to prove three things at once: SendGrid accepts mail from this deployment's
 * sender, the message reaches a real inbox, and it lands in the inbox rather
 * than spam. It says so in the body, so the person reading it knows what to
 * check.
 */
export function TestEmail({
  sentBy,
  sentAt,
  siteUrl,
}: {
  sentBy: string;
  sentAt: string;
  siteUrl: string;
}) {
  return (
    <EmailLayout preview="FishSpotter test email">
      <Text style={{ fontSize: 22, fontWeight: 700, color: "#17252A", marginTop: 16 }}>
        This is a test email.
      </Text>
      <Text style={{ fontSize: 14, lineHeight: 1.55, color: "#17252A" }}>
        It was sent from the email diagnostics page on {siteUrl} by {sentBy} at {sentAt}.
        If you are reading it, SendGrid is accepting mail from this deployment and it is
        reaching an inbox.
      </Text>
      <Text style={{ fontSize: 12, lineHeight: 1.5, color: "#5A6E74" }}>
        Two things worth a glance: whether it landed in the inbox or in spam, and whether
        your mail client shows the sender as authenticated. Nothing else to do.
      </Text>
    </EmailLayout>
  );
}
