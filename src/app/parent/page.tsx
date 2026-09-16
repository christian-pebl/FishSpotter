import type { Metadata } from "next";
import Link from "next/link";
import { MarineBackdrop } from "@/components/MarineBackdrop";
import { BackToFeed } from "@/components/BackToFeed";
import { ParentLinkForm } from "@/components/parent/ParentLinkForm";
import { SUPPORT_EMAIL } from "@/lib/email/outcome";

export const metadata: Metadata = {
  title: "For parents and carers",
  description:
    "How PEBL FishSpotter looks after children who play, what we keep, and how a parent or carer can review, download or delete their child's information.",
};

/**
 * The page a parent reaches from our emails, the guest start screen or the
 * privacy policy. It explains, in plain words, how children use FishSpotter
 * (src/lib/age.ts), and gives a parent the way in to their rights: an emailed
 * link to the manage page (COPPA: review, delete, refuse further collection).
 */
export default function ParentPage() {
  return (
    <MarineBackdrop>
      <div className="flex-1 overflow-y-auto">
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">
          <BackToFeed />

          <header className="mt-3">
            <p className="pebl-eyebrow text-xs">For parents and carers</p>
            <h1 className="mt-1 font-brand-heading text-h1 text-navy-900">
              Children on FishSpotter
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-navy-900/80">
              FishSpotter is a free citizen-science game from Plant Ecology Beyond Land (PEBL) CIC.
              Players watch short underwater clips from UK seaweed farms and name the animals they
              see. Children use it at home and at school, so it is built to be safe for them.
            </p>
          </header>

          <section className="pebl-surface mt-6 rounded-card p-6 md:p-8" aria-labelledby="parent-how">
            <h2 id="parent-how" className="text-2xl font-bold text-navy-900">
              How we look after children
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-navy-900">
              <li>Everyone is asked their age group before they start. We keep the group, never a birthday.</li>
              <li>
                Under-13s play with a nickname they pick from names we make up, so they never type
                their real name. We never ask them for their email address.
              </li>
              <li>
                To keep an under-13&apos;s progress for good, or to post any prize to anyone under
                18, we email a parent or carer and wait for them to say yes.
              </li>
              <li>
                Under-13s are never shown on public leaderboards or profile pages and cannot post
                comments. Under-18s are private by default.
              </li>
              <li>
                There is no advertising, no private messaging, and no marketing email to under-18s.
                We never sell or share children&apos;s information.
              </li>
            </ul>
            <p className="mt-3 text-sm leading-7 text-navy-900">
              The full detail, including what we keep and for how long, is in our{" "}
              <Link href="/privacy#children" className="text-teal-700 underline">
                privacy policy
              </Link>
              . Prizes follow the{" "}
              <Link href="/prize-rules" className="text-teal-700 underline">
                prize rules
              </Link>
              .
            </p>
          </section>

          <section className="pebl-surface mt-6 rounded-card p-6 md:p-8" aria-labelledby="parent-manage">
            <h2 id="parent-manage" className="text-2xl font-bold text-navy-900">
              Manage your child&apos;s account
            </h2>
            <p className="mt-3 text-sm leading-7 text-navy-900">
              If you have agreed to your child&apos;s account or prize, enter the email address you
              used. We&apos;ll send you a link to see what we hold, download it, sign your child in
              on a device, withdraw your agreement, or delete their account.
            </p>
            <ParentLinkForm />
          </section>

          <section className="pebl-surface mt-6 rounded-card p-6 md:p-8" aria-labelledby="parent-contact">
            <h2 id="parent-contact" className="text-2xl font-bold text-navy-900">
              Questions or concerns
            </h2>
            <p className="mt-3 text-sm leading-7 text-navy-900">
              Email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-teal-700 underline">
                {SUPPORT_EMAIL}
              </a>{" "}
              and we will reply within one month, usually much sooner. If you think your child
              gave us information without your permission, tell us and we will delete it. Plant
              Ecology Beyond Land (PEBL) CIC, company number 12076622, registered office PO Box SA29JA, 29 Glan Yr Afon Road,
              Sketty, Swansea, United Kingdom, SA2 9JA.
            </p>
          </section>
        </main>
      </div>
    </MarineBackdrop>
  );
}
