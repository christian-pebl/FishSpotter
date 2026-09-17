"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  sendAgeNotice,
  sendAgeNoticePreview,
  type NoticePreviewResult,
  type NoticeSendResult,
} from "./actions";
import type { AgeNoticeRow } from "@/lib/age-notice";

/** Resend allows two requests a second; space sends a little wider. */
const SEND_SPACING_MS = 600;
/** Two refusals in a row means the rest would be refused too. */
const STOP_AFTER_FAILURES = 2;

type RowState = "sending" | NoticeSendResult;

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function ResultCell({ row, state }: { row: AgeNoticeRow; state: RowState | undefined }) {
  if (state === "sending") return <span className="text-navy-600">Sending…</span>;
  if (state?.outcome === "sent") {
    return <span className="font-semibold text-teal-700">Sent, {state.detail}</span>;
  }
  if (state?.outcome === "skipped") return <span className="text-navy-600">Skipped: {state.detail}</span>;
  if (state?.outcome === "failed") return <span className="text-incorrect-ink">Failed: {state.detail}</span>;
  if (row.noticeSentAt) {
    return (
      <span className="text-navy-700">
        Told on {row.noticeSentOn}; address removed on {row.removalOn}
      </span>
    );
  }
  return <span className="text-navy-400">Not told yet</span>;
}

/**
 * The notice to school-like addresses (src/lib/age-notice.ts): preview it,
 * choose who gets it, send, watch each row resolve. Nothing goes without a
 * confirm, and the server re-checks every account before mailing it.
 */
export function AgeNoticeSender({ rows, adminEmail }: { rows: AgeNoticeRow[]; adminEmail: string }) {
  const router = useRouter();
  const pending = rows.filter((r) => !r.noticeSentAt);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(pending.map((r) => r.userId)));
  const [states, setStates] = useState<Record<string, RowState>>({});
  const [running, setRunning] = useState(false);
  const [stopNote, setStopNote] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<NoticePreviewResult | null>(null);
  const stopRef = useRef(false);

  const chosen = pending.filter((r) => selected.has(r.userId));
  const sentCount = Object.values(states).filter((s) => s !== "sending" && s.outcome === "sent").length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const sendPreview = async () => {
    setPreviewing(true);
    try {
      setPreview(await sendAgeNoticePreview());
    } catch (err) {
      setPreview({
        to: adminEmail,
        outcome: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setPreviewing(false);
    }
  };

  const sendChosen = async () => {
    if (chosen.length === 0) return;
    const ok = window.confirm(
      `Send the notice to ${chosen.length} ${chosen.length === 1 ? "account" : "accounts"}? Their addresses will be removed 14 days later. Emails cannot be recalled.`,
    );
    if (!ok) return;
    stopRef.current = false;
    setStopNote(null);
    setRunning(true);
    let failuresInARow = 0;
    for (const row of chosen) {
      if (stopRef.current) {
        setStopNote("Stopped. Anyone not marked Sent was not mailed.");
        break;
      }
      setStates((s) => ({ ...s, [row.userId]: "sending" }));
      let result: NoticeSendResult;
      try {
        result = await sendAgeNotice(row.userId);
      } catch (err) {
        result = {
          userId: row.userId,
          outcome: "failed",
          detail: err instanceof Error ? err.message : String(err),
        };
      }
      setStates((s) => ({ ...s, [row.userId]: result }));
      failuresInARow = result.outcome === "failed" ? failuresInARow + 1 : 0;
      if (failuresInARow >= STOP_AFTER_FAILURES) {
        setStopNote("Stopped after two refusals in a row. Check the preview's result for the reason.");
        break;
      }
      await sleep(SEND_SPACING_MS);
    }
    setRunning(false);
    router.refresh();
  };

  if (rows.length === 0) {
    return <p className="mt-2 text-sm text-navy-600">No accounts with a school-like address need the notice.</p>;
  }

  return (
    <div className="mt-2 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={sendPreview}
          disabled={previewing || running}
          className="inline-flex h-11 items-center rounded-full border border-teal-600 px-4 text-sm font-medium text-teal-700 transition hover:bg-teal-50 disabled:opacity-60"
        >
          {previewing ? "Sending…" : "Send me a preview"}
        </button>
        {preview ? (
          preview.outcome === "sent" ? (
            <span className="text-[12px] text-teal-700">Preview sent to {preview.to}.</span>
          ) : (
            <span role="alert" className="text-[12px] text-incorrect-ink">
              Preview not sent: {preview.error ?? preview.outcome}
            </span>
          )
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-card border border-navy-200/60 bg-white">
        <table className="w-full min-w-[640px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-navy-200/60 text-[10px] uppercase tracking-wide text-navy-500">
              <th className="px-3 py-2">
                <span className="sr-only">Include</span>
              </th>
              <th className="px-3 py-2">Spotter</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Joined</th>
              <th className="px-3 py-2 text-right">IDs</th>
              <th className="px-3 py-2">Notice</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-200/60">
            {rows.map((r) => (
              <tr key={r.userId}>
                <td className="px-1 py-1">
                  <label className="inline-flex h-11 w-11 cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      checked={!r.noticeSentAt && selected.has(r.userId)}
                      disabled={!!r.noticeSentAt || running}
                      onChange={() => toggle(r.userId)}
                      aria-label={`Include ${r.spotter}`}
                      className="h-4 w-4 accent-teal-600"
                    />
                  </label>
                </td>
                <td className="px-3 py-2 text-navy-900">{r.spotter}</td>
                <td className="whitespace-nowrap px-3 py-2 text-navy-900">{r.email}</td>
                <td className="whitespace-nowrap px-3 py-2 text-navy-600">{r.joinedAt.slice(0, 10)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.identifications}</td>
                <td className="px-3 py-2">
                  <ResultCell row={r} state={states[r.userId]} />
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
          {running ? `Sending… ${sentCount} sent` : `Send the notice to ${chosen.length}`}
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
        ) : null}
      </div>

      {stopNote ? (
        <p role="status" className="rounded-modal border border-warn/40 bg-warn/10 p-3 text-sm text-navy-900">
          {stopNote}
        </p>
      ) : null}
    </div>
  );
}
