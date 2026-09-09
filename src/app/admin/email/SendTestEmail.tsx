"use client";

import { useState } from "react";
import { sendTestEmail, type TestSendResult } from "./actions";

/**
 * One button, one honest answer. The result block quotes the provider
 * verbatim on a failure, because "SendGrid 403: The from address does not
 * match a verified Sender Identity" is the whole diagnosis, and it was only
 * ever visible in Vercel's function logs before this page existed.
 */
export function SendTestEmail({
  to,
  redirectedTo,
}: {
  to: string;
  /** Set on preview deploys, where every message is redirected to the catch-all. */
  redirectedTo: string | null;
}) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<TestSendResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const send = async () => {
    setSending(true);
    setFailure(null);
    try {
      setResult(await sendTestEmail());
    } catch (err) {
      setResult(null);
      setFailure(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const destination = redirectedTo ?? to;

  return (
    <div>
      <button
        type="button"
        onClick={send}
        disabled={sending}
        className="inline-flex h-11 items-center rounded-full bg-teal-600 px-4 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
      >
        {sending ? "Sending…" : `Send a test email to ${destination}`}
      </button>
      {redirectedTo && (
        <p className="pt-2 text-[12px] text-navy-600">
          This is a preview deployment, so the message goes to the catch-all address, not to{" "}
          {to}.
        </p>
      )}

      {failure && (
        <p role="alert" className="mt-3 rounded-modal border border-danger/40 bg-danger/5 p-3 text-sm text-navy-900">
          The request itself failed: {failure}
        </p>
      )}

      {result && result.outcome === "sent" && (
        <div className="mt-3 rounded-modal border border-teal-500/40 bg-teal-50 p-3 text-sm text-navy-900">
          <p className="font-semibold">SendGrid accepted the message.</p>
          <p className="pt-1 text-navy-700">
            Sent at {new Date(result.sentAt).toLocaleString()}
            {result.messageId ? `, message id ${result.messageId}` : ""}. Now check the inbox at{" "}
            {destination}, and its spam folder. Accepted means SendGrid took it; arrived is the
            thing to confirm.
          </p>
        </div>
      )}

      {result && result.outcome === "not-configured" && (
        <div role="alert" className="mt-3 rounded-modal border border-warn/40 bg-warn/10 p-3 text-sm text-navy-900">
          <p className="font-semibold">Nothing was sent: the provider is not configured.</p>
          <p className="pt-1 text-navy-700">{result.error}</p>
          <p className="pt-1 text-navy-700">
            Set the missing variables in Vercel (Production) and redeploy; a new env var does not
            reach an already-built deployment.
          </p>
        </div>
      )}

      {result && result.outcome === "failed" && (
        <div role="alert" className="mt-3 rounded-modal border border-danger/40 bg-danger/5 p-3 text-sm text-navy-900">
          <p className="font-semibold">SendGrid refused it.</p>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-modal bg-navy-50 p-2 text-[12px] text-navy-800">
            {result.error}
          </pre>
          <p className="pt-2 text-navy-700">
            A 401 is a bad or revoked API key. A 403 naming a sender identity means the from
            address is not verified in SendGrid (Settings, Sender Authentication). The fix is in
            SendGrid or Vercel, not in this app.
          </p>
        </div>
      )}
    </div>
  );
}
