import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin";
import { getEmailConfig } from "@/lib/email/client";
import {
  MIN_REQUESTS_FOR_VERDICT,
  summariseVerificationTokens,
  type VerificationStats,
} from "@/lib/email/verification-stats";
import { SITE_URL } from "@/lib/site-url";
import { SendTestEmail } from "./SendTestEmail";

/**
 * Email delivery diagnostics (8 Sep 2026).
 *
 * Built after a new spotter wrote in: they pressed "resend verification" for
 * days, the app said "Email sent" every time, and nothing ever arrived. Every
 * part of that failure was invisible from inside the app: a missing SendGrid
 * key was a console warning, a refused send was a console error, and no
 * figure anywhere counted "verification links requested" against "clicked".
 * This page makes all three visible without opening Vercel or SendGrid:
 *
 *   1. Is the sender configured at all? (the env vars, never their values)
 *   2. Are verification emails getting through? (requested vs. clicked,
 *      from the VerificationToken rows the app already keeps)
 *   3. Does a real message reach a real inbox right now? (a test send to
 *      the admin's own address, quoting SendGrid verbatim on a refusal)
 *
 * Read-only apart from the test send, which is admin-gated in its action.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Email · FishSpotter admin" };

const DAY_MS = 24 * 60 * 60 * 1000;

const VERDICT_COPY: Record<VerificationStats["verdict"], { title: string; body: string; tone: "quiet" | "good" | "warn" | "bad" }> = {
  "no-data": {
    title: "Too few requests to judge from",
    body: `Fewer than ${MIN_REQUESTS_FOR_VERDICT} verification emails were requested in the last 30 days. Use the test send below instead.`,
    tone: "quiet",
  },
  delivering: {
    title: "Delivery looks healthy",
    body: "Most verification links requested in the last 30 days were clicked.",
    tone: "good",
  },
  partial: {
    title: "Fewer than half of the links were clicked",
    body: "Some people never look, so this is not alarming on its own. Worth a test send to be sure the ones that were not clicked arrived.",
    tone: "warn",
  },
  "not-delivering": {
    title: "Nobody is clicking these links",
    body: "Verification emails were requested in the last 30 days and not one link was clicked. That is the signature of a sender that is configured but not delivering, or of every message landing in spam. Send yourself a test email below; if it does not arrive, the problem is in SendGrid or Vercel, not in this app.",
    tone: "bad",
  },
};

const TONE_CLASS: Record<"quiet" | "good" | "warn" | "bad", string> = {
  quiet: "border-navy-200 bg-white",
  good: "border-teal-500/40 bg-teal-50",
  warn: "border-warn/40 bg-warn/10",
  bad: "border-danger/40 bg-danger/5",
};

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <tr className="border-t border-navy-200/60">
      <th scope="row" className="py-2 pr-4 text-left font-mono text-[12px] font-medium text-navy-700">
        {label}
      </th>
      <td className="py-2 text-navy-900">
        {value}
        {note && <span className="block text-[12px] text-navy-600">{note}</span>}
      </td>
    </tr>
  );
}

export default async function AdminEmailPage() {
  const { email: adminEmail } = await requireAdminSession();
  const now = new Date();
  const since = new Date(now.getTime() - 30 * DAY_MS);
  const config = getEmailConfig();
  const vercelEnv = process.env.VERCEL_ENV ?? null;
  const catchall = process.env.EMAIL_PREVIEW_CATCHALL?.trim() || null;
  const redirectedTo = vercelEnv && vercelEnv !== "production" ? catchall : null;

  const [tokens, signups, verifiedSignups] = await Promise.all([
    prisma.verificationToken.findMany({
      where: { createdAt: { gte: since } },
      select: {
        createdAt: true,
        consumedAt: true,
        expiresAt: true,
        user: { select: { emailVerified: true } },
      },
    }),
    prisma.user.count({ where: { isGuest: false, createdAt: { gte: since } } }),
    prisma.user.count({
      where: { isGuest: false, createdAt: { gte: since }, emailVerified: { not: null } },
    }),
  ]);

  const stats = summariseVerificationTokens(
    tokens.map((t) => ({
      createdAt: t.createdAt,
      consumedAt: t.consumedAt,
      expiresAt: t.expiresAt,
      userEmailVerified: t.user.emailVerified,
    })),
    now,
  );
  const verdict = VERDICT_COPY[stats.verdict];
  const configured = config.missing.length === 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-brand text-h2 text-navy-900">Email delivery</h1>
        <p className="pt-1 text-sm text-navy-600">
          Whether verification and reset emails are actually reaching people. Three checks, from
          cheapest to most conclusive.
        </p>
      </header>

      <section className="rounded-card border border-navy-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-navy-900">1. Is the sender configured?</h2>
        <p
          className={`mt-2 rounded-modal border p-3 text-sm ${
            configured ? TONE_CLASS.good : TONE_CLASS.bad
          }`}
          role={configured ? undefined : "alert"}
        >
          {configured ? (
            <>
              <span className="font-semibold">Yes.</span> Both variables sending needs are set on
              this deployment. That does not prove SendGrid accepts the sender; the test send does.
            </>
          ) : (
            <>
              <span className="font-semibold">No.</span> {config.missing.join(" and ")}{" "}
              {config.missing.length === 1 ? "is" : "are"} not set on this deployment, so every
              verification and reset email is silently skipped, and the app now tells people so.
              Set {config.missing.length === 1 ? "it" : "them"} in Vercel (Production) and
              redeploy; a new env var does not reach an already-built deployment.
            </>
          )}
        </p>
        <table className="mt-3 w-full text-sm">
          <tbody>
            <Row
              label="SENDGRID_API_KEY"
              value={config.apiKey ? "set" : "not set"}
              note="The value is never shown here."
            />
            <Row label="EMAIL_FROM_ADDRESS" value={config.fromAddress ?? "not set"} note="Must be a sender SendGrid has verified (Settings, Sender Authentication), or every send is refused with a 403." />
            <Row label="EMAIL_FROM_NAME" value={config.fromName} />
            <Row label="EMAIL_REPLY_TO" value={config.replyTo ?? "not set (replies go to the from address)"} />
            <Row
              label="EMAIL_PREVIEW_CATCHALL"
              value={catchall ?? "not set"}
              note={
                redirectedTo
                  ? "This is a preview deployment: every message is redirected here."
                  : "Only used on preview deployments; production sends to the real recipient."
              }
            />
            <Row label="VERCEL_ENV" value={vercelEnv ?? "not set (local)"} />
            <Row label="Links in emails" value={SITE_URL} note="From NEXT_PUBLIC_SITE_URL, else the built-in default." />
          </tbody>
        </table>
      </section>

      <section className="rounded-card border border-navy-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-navy-900">
          2. Are verification emails getting through?
        </h2>
        <p className="pt-1 text-[12px] text-navy-600">
          Every send mints one verification token; clicking the link consumes it. Requested
          against clicked, from the app&apos;s own rows, no SendGrid access needed.
        </p>
        <div
          className={`mt-3 rounded-modal border p-3 text-sm text-navy-900 ${TONE_CLASS[verdict.tone]}`}
          role={verdict.tone === "bad" ? "alert" : undefined}
        >
          <p className="font-semibold">{verdict.title}</p>
          <p className="pt-1 text-navy-700">{verdict.body}</p>
        </div>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-navy-600">
              <th className="py-1 pr-4 font-medium">Window</th>
              <th className="py-1 pr-4 font-medium">Requested</th>
              <th className="py-1 pr-4 font-medium">Clicked</th>
            </tr>
          </thead>
          <tbody>
            {stats.windows.map((w) => (
              <tr key={w.days} className="border-t border-navy-200/60">
                <td className="py-2 pr-4 text-navy-900">Last {w.days} days</td>
                <td className="py-2 pr-4 tabular-nums text-navy-900">{w.requested}</td>
                <td className="py-2 pr-4 tabular-nums text-navy-900">{w.clicked}</td>
              </tr>
            ))}
            <tr className="border-t border-navy-200/60">
              <td className="py-2 pr-4 text-navy-900">Links still live right now</td>
              <td className="py-2 pr-4 tabular-nums text-navy-900" colSpan={2}>
                {stats.outstanding}
              </td>
            </tr>
            <tr className="border-t border-navy-200/60">
              <td className="py-2 pr-4 text-navy-900">Accounts created in the last 30 days</td>
              <td className="py-2 pr-4 tabular-nums text-navy-900" colSpan={2}>
                {signups}, of which {verifiedSignups} verified
              </td>
            </tr>
          </tbody>
        </table>
        <p className="pt-2 text-[12px] text-navy-600">
          A click is a consumed token whose owner was verified at that moment. Tokens that a
          resend retired before this page existed do not count as clicks.
        </p>
      </section>

      <section className="rounded-card border border-navy-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-navy-900">3. Does a message reach an inbox?</h2>
        <p className="pb-3 pt-1 text-[12px] text-navy-600">
          Sends one real email to your own address through the same code path as a verification
          email, and quotes SendGrid verbatim if it refuses.
        </p>
        <SendTestEmail to={adminEmail} redirectedTo={redirectedTo} />
      </section>

      <section className="rounded-card border border-navy-200 bg-white p-4 text-sm text-navy-700">
        <h2 className="text-sm font-semibold text-navy-900">If it is not working</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Not configured above: set the variables in Vercel, Production, then redeploy.</li>
          <li>
            Test send refused with a 403: verify the from address&apos;s domain in SendGrid
            (Settings, Sender Authentication) and check the three CNAMEs are DNS-only, not
            proxied.
          </li>
          <li>
            Test send accepted but nothing arrives: SendGrid, Activity feed, search for your
            address. A bounce or a block names the reason.
          </li>
          <li>
            Arrives in spam: the domain needs SPF and DKIM via SendGrid&apos;s domain
            authentication, and a DMARC record.
          </li>
        </ol>
        <p className="pt-2 text-[12px] text-navy-600">
          The full runbook is docs/runbooks/transactional-email.md in the repository.
        </p>
      </section>
    </div>
  );
}
