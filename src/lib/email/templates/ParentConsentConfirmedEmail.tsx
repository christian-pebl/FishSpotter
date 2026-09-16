import { Button, Text } from "@react-email/components";
import { EmailLayout } from "./_Layout";
import { ParentNotice } from "./ParentNotice";
import type { ParentalConsentPurpose } from "@/lib/parental-consent-shared";

const P = { fontSize: 14, lineHeight: 1.55, color: "#17252A" } as const;
const SMALL = { fontSize: 12, lineHeight: 1.5, color: "#5A6E74" } as const;

/**
 * The "plus" in email plus: sent a day after a parent agrees (by the
 * child-data-retention cron), repeating the notice and saying how to
 * withdraw, so a child who typed their own second address, or a parent who
 * clicked by mistake, has a way to undo it. The link opens the parent page
 * for CONFIRMATION_MANAGE_TTL_WORDS.
 */
export function ParentConsentConfirmedEmail({
  childName,
  purpose,
  manageUrl,
  parentPageUrl,
  expiresIn,
  grantedOn,
}: {
  childName: string;
  /** The day the parent agreed, in words, e.g. "16 September 2026". */
  grantedOn: string;
  purpose: ParentalConsentPurpose;
  manageUrl: string;
  parentPageUrl: string;
  expiresIn: string;
}) {
  const isPrize = purpose === "prize";
  return (
    <EmailLayout preview={`Confirming your agreement for ${childName} on FishSpotter`}>
      <Text style={{ fontSize: 22, fontWeight: 700, color: "#17252A", marginTop: 16 }}>
        Confirming your agreement
      </Text>
      <Text style={P}>Hello,</Text>
      <Text style={P}>
        {isPrize
          ? `On ${grantedOn} you agreed that we can post the FishSpotter prize to ${childName}. If they claim it, we will email you to ask for a UK address.`
          : `On ${grantedOn} you agreed that ${childName} can keep a FishSpotter account. Their progress is saved.`}
      </Text>
      <Text style={P}>As a reminder, this is what you agreed to.</Text>

      <ParentNotice purpose={purpose} />

      <Text style={{ ...P, fontWeight: 700 }}>If this was not you, or you change your mind</Text>
      <Text style={P}>
        Open the link below to withdraw your agreement
        {isPrize ? "" : ` and delete ${childName}'s account`}. You can also see what we hold and
        download a copy
        {isPrize ? "." : `, or sign ${childName} in on another device by opening the link on that device.`}
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
        This link works for {expiresIn}. After that, ask for a new one at {parentPageUrl} using this
        email address. Questions: hello@pebl-cic.co.uk.
      </Text>
    </EmailLayout>
  );
}
