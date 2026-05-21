import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Accessibility",
  description: "PEBL FishSpotter accessibility statement and WCAG conformance posture.",
};

export default async function AccessibilityPage() {
  return <LegalLayout eyebrow="Accessibility" file="accessibility-statement.md" />;
}
