import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MarineBackdrop } from "@/components/MarineBackdrop";
import { ConsentDecision } from "@/components/parent/ConsentDecision";
import { ParentNotice } from "@/lib/email/templates/ParentNotice";
import { CONSENT_REQUEST_TTL_WORDS, findPendingConsentByToken } from "@/lib/parental-consent";

export const dynamic = "force-dynamic";

// The token in the URL is a credential: keep the page out of search results
// and out of the Referer header of any link followed from it.
export const metadata: Metadata = {
  title: "Your child's FishSpotter request",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const KEY_POINTS = {
  account: [
    "We keep their nickname, the animals they spot, and their points. Never their name, email or location.",
    "They are never shown publicly and cannot post comments.",
    "No advertising, and we never sell or share their information.",
    "You can see it, download it or delete it at any time.",
  ],
  prize: [
    "We email you, not your child, to ask where to send the book.",
    "Postage is free, to UK addresses only.",
    "Your address is used only to send the book.",
    "You can change your mind at any time before it is posted.",
  ],
} as const;

/**
 * Where a parent lands from the consent email. Built to be decided in under a
 * minute on a phone: who is asking and for what, four plain points, then the
 * two buttons, with the full notice (the same ParentNotice the email carries)
 * one tap away. Nothing is agreed by loading the page.
 */
export default async function ParentConsentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const pending = await findPendingConsentByToken(prisma, token, new Date());

  return (
    <MarineBackdrop>
      <div className="flex-1 overflow-y-auto">
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-xl px-4 pb-16 pt-6">
          <section className="pebl-surface rounded-card p-6 md:p-8">
            <p className="pebl-eyebrow text-xs">PEBL FishSpotter · for parents and carers</p>
            {!pending ? (
              <>
                <h1 className="mt-2 font-brand-heading text-h2 text-navy-900">
                  This link has expired or has been used
                </h1>
                <p className="mt-3 text-sm leading-7 text-navy-900">
                  Requests last {CONSENT_REQUEST_TTL_WORDS} and each link works once. If your child
                  still needs your OK, they can send a new request from FishSpotter. If you&apos;ve
                  already answered, you can manage their account from the{" "}
                  <Link href="/parent" className="text-teal-700 underline">
                    parent page
                  </Link>
                  .
                </p>
              </>
            ) : (
              <>
                <h1 className="mt-2 font-brand-heading text-h2 text-navy-900">
                  {pending.purpose === "prize"
                    ? `Can we post ${pending.childName} a prize?`
                    : `${pending.childName} would like to save their progress`}
                </h1>
                <p className="mt-2 text-sm leading-6 text-navy-900/80">
                  {pending.purpose === "prize"
                    ? "They play FishSpotter, our free marine citizen-science game, and are working towards its prize: a printed guide to the marine life of Britain and Ireland. As they're under 18, we need your OK before we post it."
                    : "They play FishSpotter, our free game where people name the animals in underwater clips from UK seaweed farms. As they're under 13, we need your OK to keep their account."}
                </p>

                <ul className="mt-4 space-y-2">
                  {KEY_POINTS[pending.purpose].map((point) => (
                    <li key={point} className="flex items-start gap-2 text-sm text-navy-900">
                      <svg
                        viewBox="0 0 16 16"
                        className="mt-1 h-4 w-4 shrink-0 text-teal-600"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M3 8.5l3 3L13 4.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>

                <ConsentDecision
                  token={token}
                  purpose={pending.purpose}
                  childName={pending.childName}
                />

                <details className="mt-5 border-t border-navy-900/10 pt-4">
                  <summary className="cursor-pointer text-sm font-semibold text-teal-700">
                    Full details
                  </summary>
                  <div className="mt-2">
                    <ParentNotice purpose={pending.purpose} />
                    <p className="mt-2 text-sm leading-6 text-navy-900">
                      Read our{" "}
                      <Link href="/privacy#children" className="text-teal-700 underline">
                        privacy policy
                      </Link>
                      {pending.purpose === "prize" ? (
                        <>
                          {" "}and{" "}
                          <Link href="/prize-rules" className="text-teal-700 underline">
                            prize rules
                          </Link>
                        </>
                      ) : null}
                      , or email hello@pebl-cic.co.uk with any question. If you say no, we delete
                      your email address and this request straight away.
                    </p>
                  </div>
                </details>
              </>
            )}
          </section>
        </main>
      </div>
    </MarineBackdrop>
  );
}
