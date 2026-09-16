"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  sendCatchUpEmail,
  sendCatchUpPreview,
  type CatchUpSendResult,
  type TestSendResult,
} from "./actions";
import type { CatchUpKind, CatchUpRow } from "@/lib/email/verification-backlog";

/**
 * Resend's limit is two requests a second, so sends are spaced a little wider
 * than that. 41 accounts take about half a minute.
 */
const SEND_SPACING_MS = 600;

/**
 * Two refusals in a row means the next one will be refused too (a bad key, an
 * unverified domain, the daily cap), so the run stops rather than burning
 * through the list.
 */
const STOP_AFTER_FAILURES = 2;

export interface CatchUpCopy {
  subject: string;
  intro: string;
  expiresIn: string;
}

type RowState = "sending" | CatchUpSendResult;

const KIND_LABEL: Record<CatchUpKind, string> = {
  setup: "Set a password",
  verify: "Verify",
};

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function day(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "-";
}

function ResultCell({ state }: { state: RowState | undefined }) {
  if (!state) return <span className="text-navy-400">-</span>;
  if (state === "sending") return <span className="text-navy-600">Sending…</span>;
  if (state.outcome === "sent") return <span className="font-semibold text-teal-700">Sent</span>;
  if (state.outcome === "skipped") {
    return <span className="text-navy-600">Skipped: {state.detail}</span>;
  }
  return <span className="text-incorrect-ink">Failed: {state.detail}</span>;
}

function PreviewResult({ result }: { result: TestSendResult }) {
  if (result.outcome === "sent") {
    return (
      <p className="text-[12px] text-teal-700">
        Sent to {result.to}. The button in a preview deliberately goes nowhere.
      </p>
    );
  }
  return (
    <p role="alert" className="text-[12px] text-incorrect-ink">
      Not sent: {result.error ?? result.outcome}
    </p>
  );
}

/**
 * The catch-up send (src/lib/email/verification-backlog.ts): preview each
 * email, choose who gets one, send, watch each row resolve. Nothing goes out
 * without a confirm, and the server re-checks every account before mailing it.
 */
export function VerificationCatchUp({
  rows,
  adminEmail,
  copy,
}: {
  rows: CatchUpRow[];
  adminEmail: string;
  copy: Record<CatchUpKind, CatchUpCopy>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(rows.filter((r) => r.ready).map((r) => r.userId)),
  );
  const [states, setStates] = useState<Record<string, RowState>>({});
  const [running, setRunning] = useState(false);
  const [stopNote, setStopNote] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<CatchUpKind | null>(null);
  const [previews, setPreviews] = useState<Partial<Record<CatchUpKind, TestSendResult>>>({});
  const stopRef = useRef(false);

  const chosen = rows.filter((r) => r.ready && selected.has(r.userId));
  const chosenSetup = chosen.filter((r) => r.kind === "setup").length;
  const sentCount = Object.values(states).filter(
    (s) => s !== "sending" && s.outcome === "sent",
  ).length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const preview = async (kind: CatchUpKind) => {
    setPreviewing(kind);
    try {
      const result = await sendCatchUpPreview(kind);
      setPreviews((p) => ({ ...p, [kind]: result }));
    } catch (err) {
      setPreviews((p) => ({
        ...p,
        [kind]: {
          to: adminEmail,
          outcome: "failed",
          error: err instanceof Error ? err.message : String(err),
          sentAt: new Date().toISOString(),
        },
      }));
    } finally {
      setPreviewing(null);
    }
  };

  const sendChosen = async () => {
    const targets = chosen.map((r) => r.userId);
    if (targets.length === 0) return;
    const ok = window.confirm(
      `Send ${targets.length} emails now? ${chosenSetup} set-a-password links and ${
        targets.length - chosenSetup
      } verification links. Emails cannot be recalled once sent.`,
    );
    if (!ok) return;

    stopRef.current = false;
    setStopNote(null);
    setRunning(true);
    let failuresInARow = 0;
    for (const userId of targets) {
      if (stopRef.current) {
        setStopNote("Stopped. Anyone not yet marked Sent was not mailed.");
        break;
      }
      setStates((s) => ({ ...s, [userId]: "sending" }));
      let result: CatchUpSendResult;
      try {
        result = await sendCatchUpEmail(userId);
      } catch (err) {
        result = {
          userId,
          outcome: "failed",
          kind: null,
          detail: err instanceof Error ? err.message : String(err),
        };
      }
      setStates((s) => ({ ...s, [userId]: result }));
      failuresInARow = result.outcome === "failed" ? failuresInARow + 1 : 0;
      if (failuresInARow >= STOP_AFTER_FAILURES) {
        setStopNote(
          "Stopped after two refusals in a row. Fix the cause (the test send above shows the provider's reason), then send again; accounts already mailed are skipped for 24 hours.",
        );
        break;
      }
      await sleep(SEND_SPACING_MS);
    }
    setRunning(false);
    router.refresh();
  };

  if (rows.length === 0) {
    return (
      <p className="rounded-modal border border-teal-500/40 bg-teal-50 p-3 text-sm text-navy-900">
        Every account with a real address has confirmed it. Nothing to send.
      </p>
    );
  }

  const setupTotal = rows.filter((r) => r.kind === "setup").length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-navy-700">
        {rows.length} {rows.length === 1 ? "account has" : "accounts have"} a real address and never
        confirmed it. {setupTotal} of them have no password either (guests who saved their progress),
        so they get a link to set one, which also confirms the address. The other{" "}
        {rows.length - setupTotal} get a verification link. Nobody is mailed twice within 24 hours,
        from here or anywhere else.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        {(["setup", "verify"] as const).map((kind) => (
          <div key={kind} className="rounded-modal border border-navy-200 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-600">
              {kind === "setup" ? "No password yet" : "Has a password"}
            </p>
            <p className="pt-1 text-sm font-semibold text-navy-900">{copy[kind].subject}</p>
            <p className="pt-1 text-[12px] leading-5 text-navy-700">{copy[kind].intro}</p>
            <p className="pt-1 text-[12px] text-navy-600">The link works for {copy[kind].expiresIn}.</p>
            <button
              type="button"
              onClick={() => preview(kind)}
              disabled={previewing !== null || running}
              className="mt-2 inline-flex h-11 items-center rounded-full border border-teal-600 px-4 text-sm font-medium text-teal-700 transition hover:bg-teal-50 disabled:opacity-60"
            >
              {previewing === kind ? "Sending…" : `Send me a preview`}
            </button>
            {previews[kind] ? <PreviewResult result={previews[kind]!} /> : null}
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-navy-600">
              <th className="py-1 pr-2 font-medium">
                <span className="sr-only">Include</span>
              </th>
              <th className="py-1 pr-3 font-medium">Spotter</th>
              <th className="py-1 pr-3 font-medium">Email</th>
              <th className="py-1 pr-3 font-medium">Joined</th>
              <th className="py-1 pr-3 font-medium">IDs</th>
              <th className="py-1 pr-3 font-medium">Gets</th>
              <th className="py-1 pr-3 font-medium">Last link</th>
              <th className="py-1 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.userId} className="border-t border-navy-200/60 align-top">
                <td className="py-1 pr-2">
                  <label className="inline-flex h-11 w-11 cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      checked={r.ready && selected.has(r.userId)}
                      disabled={!r.ready || running}
                      onChange={() => toggle(r.userId)}
                      aria-label={`Include ${r.spotter}`}
                      className="h-4 w-4 accent-teal-600"
                    />
                  </label>
                </td>
                <td className="py-2 pr-3 text-navy-900">
                  {r.spotter}
                  {r.seed ? (
                    <span className="ml-1 whitespace-nowrap rounded-full bg-navy-100 px-2 py-0.5 text-[10px] font-semibold text-navy-700">
                      trust seed
                    </span>
                  ) : null}
                </td>
                <td className="whitespace-nowrap py-2 pr-3 text-navy-900">{r.email}</td>
                <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-navy-700">{day(r.joinedAt)}</td>
                <td className="py-2 pr-3 tabular-nums text-navy-700">{r.identifications}</td>
                <td className="whitespace-nowrap py-2 pr-3 text-navy-700">{KIND_LABEL[r.kind]}</td>
                <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-navy-700">
                  {day(r.lastLinkAt)}
                  {r.ready ? null : <span className="block text-[11px] text-navy-500">wait 24h</span>}
                </td>
                <td className="py-2 text-[12px]">
                  <ResultCell state={states[r.userId]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={sendChosen}
          disabled={running || chosen.length === 0}
          className="inline-flex h-11 items-center rounded-full bg-teal-600 px-5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
        >
          {running ? `Sending… ${sentCount} sent` : `Send to ${chosen.length} selected`}
        </button>
        {running ? (
          <button
            type="button"
            onClick={() => {
              stopRef.current = true;
            }}
            className="inline-flex h-11 items-center rounded-full border border-navy-300 px-4 text-sm font-medium text-navy-800 hover:bg-navy-50"
          >
            Stop
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setSelected(new Set(rows.filter((r) => r.ready).map((r) => r.userId)))}
              className="inline-flex h-11 items-center rounded-full px-3 text-sm font-medium text-teal-700 hover:bg-teal-50"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="inline-flex h-11 items-center rounded-full px-3 text-sm font-medium text-teal-700 hover:bg-teal-50"
            >
              Clear
            </button>
          </>
        )}
        <span className="text-[12px] text-navy-600">
          Send yourself both previews first. Resend&apos;s free plan allows 100 emails a day.
        </span>
      </div>

      {stopNote ? (
        <p role="status" className="rounded-modal border border-warn/40 bg-warn/10 p-3 text-sm text-navy-900">
          {stopNote}
        </p>
      ) : null}
    </div>
  );
}
