import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "How PEBL FishSpotter handles your account data, quiz answers, and cookies.",
};

export default async function PrivacyPage() {
  return <LegalLayout eyebrow="Privacy" file="privacy-policy.md" />;
}
