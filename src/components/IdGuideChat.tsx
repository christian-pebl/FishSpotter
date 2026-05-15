"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Candidate } from "@/lib/idguide/narrow";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type StreamEvent =
  | { type: "text"; text: string }
  | { type: "candidates"; candidates: Candidate[] }
  | { type: "done" }
  | { type: "error"; message: string };

const MAX_USER_TURNS = 8;
const SEED_GREETING =
  "Hi — I help spot fish from PEBL clips on the Welsh coast. Tell me what stands out: shape, colour, markings, how it's moving, or where it is. I'll narrow it down with you.";

export function IdGuideChat({
  snippetId,
  onPickCandidate,
  onFallback,
}: {
  snippetId: string;
  onPickCandidate: (commonName: string) => void;
  onFallback: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: SEED_GREETING },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const userTurns = messages.filter((m) => m.role === "user").length;
  const turnsRemaining = MAX_USER_TURNS - userTurns;

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || streaming || turnsRemaining <= 0) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setStreaming(true);
    setError(null);

    // Append an empty assistant message we'll stream into.
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/idguide/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snippetId, messages: nextMessages }),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({ error: "Chat unavailable" }));
        throw new Error(detail.error ?? `HTTP ${res.status}`);
      }
      if (!res.body) throw new Error("Empty response");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE: data: <json>\n\n
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const chunk = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (!chunk.startsWith("data: ")) continue;
          const payload = chunk.slice("data: ".length);
          if (!payload) continue;
          let evt: StreamEvent;
          try {
            evt = JSON.parse(payload) as StreamEvent;
          } catch {
            continue;
          }
          if (evt.type === "text") {
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last && last.role === "assistant") {
                copy[copy.length - 1] = { ...last, content: last.content + evt.text };
              }
              return copy;
            });
          } else if (evt.type === "candidates") {
            setCandidates(evt.candidates);
          } else if (evt.type === "error") {
            throw new Error(evt.message);
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Chat failed";
      setError(message);
    } finally {
      setStreaming(false);
    }
  }, [input, streaming, messages, snippetId, turnsRemaining]);

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-auto max-w-[80%] rounded-2xl bg-[#3AAFA9] px-3 py-2 text-sm text-[#17252A]"
                : "mr-auto max-w-[85%] rounded-2xl bg-white/10 px-3 py-2 text-sm text-white/90"
            }
          >
            {m.content || (streaming && i === messages.length - 1 ? <span className="opacity-60">…</span> : null)}
          </div>
        ))}

        {candidates.length > 0 && (
          <div className="mt-3 border-t border-white/10 pt-2">
            <p className="pb-1.5 text-[10px] uppercase tracking-wider text-white/55">
              Candidates the biologist is narrowing
            </p>
            <div className="space-y-1.5">
              {candidates.slice(0, 5).map((c) => {
                const isExpanded = expanded === c.scientificName;
                return (
                  <div
                    key={c.scientificName}
                    className="rounded-xl border border-white/10 bg-white/5"
                  >
                    <button
                      type="button"
                      onClick={() => setExpanded(isExpanded ? null : c.scientificName)}
                      aria-expanded={isExpanded}
                      className="block w-full px-2.5 py-1.5 text-left text-[12px] hover:bg-white/10"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-white/90">{c.commonName}</span>
                        <span className="text-[10px] text-white/40">
                          {isExpanded ? "Hide" : "Details"}
                        </span>
                      </div>
                      <div className="text-[10px] italic text-white/50">{c.scientificName}</div>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-white/10 px-2.5 py-2">
                        <p className="text-[11px] text-white/70">
                          Matches {c.matchedTraits} of {c.totalTraitsConsidered} traits you've
                          mentioned.
                        </p>
                        <button
                          type="button"
                          onClick={() => onPickCandidate(c.commonName)}
                          className="mt-2 rounded-full bg-[#3AAFA9] px-3 py-1 text-[11px] font-semibold text-[#17252A] hover:bg-[#59c8c3]"
                        >
                          Use this as my answer
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="pt-2 text-[10px] text-white/45">
              Tap a row to inspect — you decide whether to use it.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">
            {error}.{" "}
            <button onClick={onFallback} className="underline hover:text-red-100">
              Switch to manual filter
            </button>
            .
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-white/10 bg-[#0f1d22]/95 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={
              turnsRemaining > 0
                ? "Describe what you saw…"
                : "Conversation complete — start a new chat for more"
            }
            rows={1}
            disabled={streaming || turnsRemaining <= 0}
            className="max-h-24 flex-1 resize-none rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-[#3AAFA9] focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={streaming || !input.trim() || turnsRemaining <= 0}
            className="rounded-full bg-[#3AAFA9] px-3 py-2 text-sm font-semibold text-[#17252A] hover:bg-[#59c8c3] disabled:opacity-40"
          >
            Send
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10px] text-white/45">
          <button type="button" onClick={onFallback} className="hover:text-white/80">
            Prefer to filter manually?
          </button>
          <span>
            {turnsRemaining} turn{turnsRemaining === 1 ? "" : "s"} left
          </span>
        </div>
      </div>
    </div>
  );
}
