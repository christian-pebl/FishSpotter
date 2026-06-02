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
// TODO(region): "Welsh coast" is hardcoded to the current deployment
// region. When the snippet library expands beyond Welsh waters, derive
// the region from the active deployments (or drop the geography clause)
// rather than asserting it in the seed greeting + persona prompt.
const SEED_GREETING =
  "Hi, I help spot fish from PEBL clips on the Welsh coast. Tell me what stands out: shape, colour, markings, how it's moving, or where it is. I'll narrow it down with you.";

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
  // The assistant has accepted the turn but no tokens have arrived yet —
  // distinct from "streaming" so we can show "thinking…" vs "typing".
  const [awaitingFirstToken, setAwaitingFirstToken] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-focus the input when the chat mounts.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  // Abort any in-flight fetch on unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  const userTurns = messages.filter((m) => m.role === "user").length;
  const turnsRemaining = MAX_USER_TURNS - userTurns;

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setAwaitingFirstToken(false);
  }, []);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || streaming || turnsRemaining <= 0) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setStreaming(true);
    setAwaitingFirstToken(true);
    setError(null);

    // Append an empty assistant message we'll stream into.
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/idguide/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snippetId, messages: nextMessages }),
        signal: controller.signal,
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
            if (awaitingFirstToken) setAwaitingFirstToken(false);
            setAwaitingFirstToken(false);
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
      if (controller.signal.aborted) {
        // Surface the cancellation in the assistant bubble instead of an error.
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant" && !last.content) {
            copy[copy.length - 1] = { ...last, content: "(stopped)" };
          }
          return copy;
        });
      } else {
        const message = err instanceof Error ? err.message : "Chat failed";
        setError(message);
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
      setAwaitingFirstToken(false);
    }
  }, [input, streaming, messages, snippetId, turnsRemaining, awaitingFirstToken]);

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
        {messages.map((m, i) => {
          const isLast = i === messages.length - 1;
          const isStreamingBubble = isLast && m.role === "assistant" && streaming;
          return (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-auto max-w-[80%] rounded-2xl bg-teal-500 px-3 py-2 text-sm text-navy-900"
                  : "mr-auto max-w-[85%] rounded-2xl bg-white/10 px-3 py-2 text-sm text-white/90"
              }
            >
              {m.content || (isStreamingBubble ? <ThinkingDots /> : null)}
            </div>
          );
        })}

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
                    className="rounded-modal border border-white/10 bg-white/5"
                  >
                    <button
                      type="button"
                      onClick={() => setExpanded(isExpanded ? null : c.scientificName)}
                      aria-expanded={isExpanded}
                      className="flex min-h-[44px] w-full flex-col justify-center px-2.5 py-1.5 text-left text-[12px] hover:bg-white/10"
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
                          Matches {c.matchedTraits} of {c.totalTraitsConsidered} traits you&apos;ve
                          mentioned.
                        </p>
                        <button
                          type="button"
                          onClick={() => onPickCandidate(c.commonName)}
                          className="mt-2 inline-flex min-h-[44px] items-center rounded-full bg-teal-500 px-3 text-[11px] font-semibold text-navy-900 hover:bg-teal-400"
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
          <div className="rounded-modal border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">
            {error}.{" "}
            <button onClick={onFallback} className="underline hover:text-red-100">
              Switch to manual filter
            </button>
            .
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-white/10 bg-navy-800/95 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
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
            className="max-h-24 min-h-[44px] flex-1 resize-none rounded-modal border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-teal-500 focus:outline-none disabled:opacity-50"
          />
          {streaming ? (
            <button
              type="button"
              onClick={abort}
              className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={sendMessage}
              disabled={!input.trim() || turnsRemaining <= 0}
              className="rounded-full bg-teal-500 px-3 py-2 text-sm font-semibold text-navy-900 hover:bg-teal-400 disabled:opacity-40"
            >
              Send
            </button>
          )}
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

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 text-white/60">
      <span className="animate-pulse motion-reduce:animate-none">●</span>
      <span className="animate-pulse motion-reduce:animate-none [animation-delay:120ms]">●</span>
      <span className="animate-pulse motion-reduce:animate-none [animation-delay:240ms]">●</span>
    </span>
  );
}
