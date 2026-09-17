import { Button, Hr, Text } from "@react-email/components";
import { EmailLayout } from "./_Layout";

const P = { fontSize: 14, lineHeight: 1.55, color: "#17252A" } as const;
const SMALL = { fontSize: 12, lineHeight: 1.5, color: "#5A6E74" } as const;

/**
 * The one-off notice to accounts with school-like addresses
 * (src/lib/age-notice.ts): the rules have changed, this address will be
 * removed on a stated date, and what happens next.
 *
 * Written so a pupil, a parent or a teacher can read it. It explains the new
 * process without telling the reader which age answer keeps what, so it does
 * not invite anyone to give a wrong age (Children's Code, nudge techniques).
 */
export function AgePolicyNoticeEmail({
  displayName,
  removalOn,
  appUrl,
  parentUrl,
  privacyUrl,
}: {
  displayName: string;
  /** "30 September 2026". */
  removalOn: string;
  appUrl: string;
  parentUrl: string;
  privacyUrl: string;
}) {
  return (
    <EmailLayout preview={`Your FishSpotter account is changing on ${removalOn}`}>
      <Text style={{ fontSize: 22, fontWeight: 700, color: "#17252A", marginTop: 16 }}>
        Changes to your FishSpotter account
      </Text>
      <Text style={P}>Hi {displayName},</Text>
      <Text style={P}>
        We&apos;ve changed how FishSpotter looks after young spotters. Because this looks like a
        school email address, we will remove it from your FishSpotter account on{" "}
        <strong>{removalOn}</strong>. Your finds and Pebbles will not be lost.
      </Text>

      <Text style={{ ...P, fontWeight: 700 }}>What&apos;s new</Text>
      <Text style={P}>
        Everyone is now asked their age group before they play, so we can set their account up the
        right way. Spotters under 13 play with a nickname we make up for them, and a parent or carer
        can save their progress. Anyone under 18 needs a parent or carer&apos;s OK before we post
        them a prize.
      </Text>

      <Text style={{ ...P, fontWeight: 700 }}>What happens next</Text>
      <Text style={P}>
        The next time you open FishSpotter, we&apos;ll ask your age group and show you how to keep
        your progress. You can keep spotting as usual.
      </Text>

      <Button
        href={appUrl}
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
        Open FishSpotter
      </Button>

      <Hr style={{ borderColor: "#DEF2F1", margin: "20px 0 8px" }} />
      <Text style={SMALL}>
        Teachers, parents and carers: {parentUrl} explains how we look after children, and our
        privacy policy is at {privacyUrl}. If you think we&apos;ve got something wrong, email
        hello@pebl-cic.co.uk.
      </Text>
    </EmailLayout>
  );
}
