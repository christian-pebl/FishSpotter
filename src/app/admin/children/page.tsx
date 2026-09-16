import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AGE_BANDS, AGE_BAND_LABEL, isPlaceholderEmail } from "@/lib/age";
import { isRequestLive, maskEmail } from "@/lib/parental-consent";

// Read-only oversight for the children's rules (src/lib/age.ts,
// src/lib/parental-consent.ts): who has told us their age, which parent
// requests are open, and which unasked accounts hold a real email address,
// the group the 16 Sep 2026 school-address finding came from. Parent
// addresses are masked; nothing here needs them in full.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Children · FishSpotter admin" };

// Mail domains that usually belong to a school or pupil. A hint for a human,
// never a decision: nothing is done to an account because of its domain.
const SCHOOLISH =
  /(\.sch\.|k12|\.edu$|\.edu\.|school|student|pupil|academy|isd\.|usd\.|schools\.|christian\.org$)/i;

function dateOnly(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "-";
}

export default async function AdminChildrenPage() {
  const now = new Date();
  const [bands, consents, unasked] = await Promise.all([
    prisma.user.groupBy({ by: ["ageBracket", "isGuest"], _count: { _all: true } }),
    prisma.parentalConsent.findMany({
      select: {
        id: true,
        purpose: true,
        status: true,
        parentEmail: true,
        requestedAt: true,
        requestExpiresAt: true,
        grantedAt: true,
        confirmationSentAt: true,
        child: { select: { id: true, displayName: true, ageBracket: true } },
      },
      orderBy: { requestedAt: "desc" },
      take: 200,
    }),
    prisma.user.findMany({
      where: { ageBracket: null, isGuest: false },
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
        _count: { select: { answers: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const count = (band: string | null, guest?: boolean) =>
    bands
      .filter((b) => b.ageBracket === band && (guest === undefined || b.isGuest === guest))
      .reduce((n, b) => n + b._count._all, 0);

  const unaskedReal = unasked.filter((u) => !isPlaceholderEmail(u.email));
  const schoolish = unaskedReal.filter((u) => SCHOOLISH.test(u.email.split("@")[1] ?? ""));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-brand text-xl font-semibold text-navy-900">Children</h1>
        <p className="mt-1 text-sm text-navy-600">
          Age groups, parent requests and the accounts still to be asked. The rules live in{" "}
          <code>src/lib/age.ts</code>; the reasoning in <code>docs/compliance/children.md</code>.
          Parents manage their own requests at <Link href="/parent" className="underline">/parent</Link>.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-navy-900">Age groups</h2>
        <table className="mt-2 w-full max-w-md text-left text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-navy-500">
              <th className="py-1">Group</th>
              <th className="py-1 text-right">Guests</th>
              <th className="py-1 text-right">Saved accounts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-200/60">
            {[...AGE_BANDS, null].map((band) => (
              <tr key={band ?? "unknown"}>
                <td className="py-1 text-navy-900">
                  {band ? AGE_BAND_LABEL[band] : "Not asked yet (hidden, no email)"}
                </td>
                <td className="py-1 text-right tabular-nums">{count(band, true)}</td>
                <td className="py-1 text-right tabular-nums">{count(band, false)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-navy-900">
          Parent requests ({consents.length})
        </h2>
        {consents.length === 0 ? (
          <p className="mt-2 text-sm text-navy-600">None yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-card border border-navy-200/60 bg-white">
            <table className="w-full min-w-[720px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-navy-200/60 text-[10px] uppercase tracking-wide text-navy-500">
                  <th className="px-3 py-2">Child</th>
                  <th className="px-3 py-2">For</th>
                  <th className="px-3 py-2">State</th>
                  <th className="px-3 py-2">Parent</th>
                  <th className="px-3 py-2">Asked</th>
                  <th className="px-3 py-2">Agreed</th>
                  <th className="px-3 py-2">Confirmation email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-200/60">
                {consents.map((c) => {
                  const state =
                    c.status === "granted"
                      ? "Agreed"
                      : isRequestLive(c, now)
                        ? "Waiting"
                        : "Expired (purged at 05:00 UTC)";
                  return (
                    <tr key={c.id}>
                      <td className="px-3 py-2 text-navy-900">
                        {c.child.displayName ?? c.child.id.slice(0, 8)}
                        <span className="block text-[10px] text-navy-400">
                          {c.child.ageBracket ?? "age not given"}
                        </span>
                      </td>
                      <td className="px-3 py-2">{c.purpose}</td>
                      <td className="px-3 py-2">{state}</td>
                      <td className="px-3 py-2 text-navy-600">{maskEmail(c.parentEmail)}</td>
                      <td className="px-3 py-2 text-navy-600">{dateOnly(c.requestedAt)}</td>
                      <td className="px-3 py-2 text-navy-600">{dateOnly(c.grantedAt)}</td>
                      <td className="px-3 py-2 text-navy-600">
                        {c.status !== "granted"
                          ? "-"
                          : c.confirmationSentAt
                            ? `sent ${dateOnly(c.confirmationSentAt)}`
                            : "due at the next 05:00 UTC run"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-navy-900">
          Saved accounts not yet asked their age ({unaskedReal.length})
        </h2>
        <p className="mt-1 text-sm text-navy-600">
          They are hidden from public lists and get no optional email until they answer, which the
          app asks on their next visit. {schoolish.length} use a school-like mail domain. Do not
          email them to ask: they may be children.
        </p>
        {unaskedReal.length > 0 ? (
          <div className="mt-2 overflow-x-auto rounded-card border border-navy-200/60 bg-white">
            <table className="w-full min-w-[560px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-navy-200/60 text-[10px] uppercase tracking-wide text-navy-500">
                  <th className="px-3 py-2">Spotter</th>
                  <th className="px-3 py-2">Mail domain</th>
                  <th className="px-3 py-2">Joined</th>
                  <th className="px-3 py-2 text-right">IDs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-200/60">
                {unaskedReal.map((u) => {
                  const domain = u.email.split("@")[1] ?? "?";
                  return (
                    <tr key={u.id}>
                      <td className="px-3 py-2 text-navy-900">{u.displayName ?? u.id.slice(0, 8)}</td>
                      <td className="px-3 py-2 text-navy-600">
                        {domain}
                        {SCHOOLISH.test(domain) ? (
                          <span className="ml-2 rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-semibold text-warn">
                            school-like
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-navy-600">{dateOnly(u.createdAt)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{u._count.answers}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
