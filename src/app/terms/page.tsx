import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Terms",
  description: "PEBL FishSpotter terms of service.",
};

export default async function TermsPage() {
  return <LegalLayout eyebrow="Terms" file="terms-of-service.md" />;
}
