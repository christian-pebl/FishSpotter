import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Prize rules",
  description:
    "Rules for the PEBL FishSpotter prize: who can claim the Seasearch guide, how, where we post it, and what we do with your details.",
};

export default async function PrizeRulesPage() {
  return <LegalLayout eyebrow="Prize rules" file="prize-rules.md" />;
}
