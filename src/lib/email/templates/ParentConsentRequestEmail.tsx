import { Button, Text } from "@react-email/components";
import { EmailLayout } from "./_Layout";
import { ParentNotice } from "./ParentNotice";
import type { ParentalConsentPurpose } from "@/lib/parental-consent-shared";

const P = { fontSize: 14, lineHeight: 1.55, color: "#17252A" } as const;
const SMALL = { fontSize: 12, lineHeight: 1.5, color: "#5A6E74" } as const;

/**
 * The notice a parent gets when a child spotter asks for their OK, carrying
 * what COPPA's direct notice must say (16 CFR 312.4(c)(1)): that we have their
 * address from the child and only to ask; that nothing more is collected
 * without a yes; what a yes lets us collect, how it is used and who sees it
 * (ParentNotice); where the full policy is; how to answer; and that an
 * unanswered request is deleted.
 *
 * The link opens a page. Opening it agrees to nothing, so a mail scanner that
 * follows links cannot consent on a parent's behalf.
 */
export function ParentConsentRequestEmail({
  childName,
  purpose,
  consentUrl,
  privacyUrl,
  expiresIn,
}: {
  childName: string;
  purpose: ParentalConsentPurpose;
  consentUrl: string;
  privacyUrl: string;
  expiresIn: string;
}) {
  const isPrize = purpose === "prize";
  return (
    <EmailLayout
      preview={
        isPrize
          ? `${childName} has won a prize on FishSpotter and needs your OK`
          : `${childName} would like to save their FishSpotter progress`
      }
    >
      <Text style={{ fontSize: 22, fontWeight: 700, color: "#17252A", marginTop: 16 }}>
        {isPrize ? "Can we post a prize to your child?" : "Can your child keep a FishSpotter account?"}
      </Text>
      <Text style={P}>Hello,</Text>
      <Text style={P}>
        A young spotter called <strong>{childName}</strong> gave us this email address as their
        parent or carer&apos;s. We use it only to ask you this.{" "}
        {isPrize
          ? "They have earned the FishSpotter prize, a printed guide to the marine life of Britain and Ireland, and because they told us they are under 18 we need your agreement before we post it."
          : "They would like to save their progress, and because they told us they are under 13 we need your agreement first."}
      </Text>
      <Text style={P}>
        FishSpotter is a free citizen-science game run by Plant Ecology Beyond Land (PEBL) CIC.
        Players watch underwater clips from UK seaweed farms and name the animals they see.
      </Text>

      <ParentNotice purpose={purpose} />

      <Text style={P}>
        Until you agree we collect nothing more from your child{isPrize ? " for the prize" : ""}.
        If you do not answer within {expiresIn}, we delete your email address and this request.
      </Text>

      <Button
        href={consentUrl}
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
        Read more and decide
      </Button>
      <Text style={{ ...SMALL, marginTop: 16 }}>Or paste this link into your browser: {consentUrl}</Text>
      <Text style={SMALL}>
        Opening the link does not agree to anything; you choose on the page. Our privacy policy,
        including how we look after children&apos;s information and your rights as a parent, is at{" "}
        {privacyUrl}. Questions: hello@pebl-cic.co.uk. If you do not know this child, ignore this
        email and we will delete your address.
      </Text>
    </EmailLayout>
  );
}
