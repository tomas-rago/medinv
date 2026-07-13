"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createNdjsonParser } from "@/lib/ai/wire";
import { MAX_MESSAGES } from "@/lib/schemas/asistencia-ia/chat";
import ChatMessage, { type AssistantSegment, type UiMessage } from "./ChatMessage";
import ChatInput from "./ChatInput";

// History sent to the API: the schema caps at MAX_MESSAGES, keep one slot
// for the new user message.
const HISTORY_LIMIT = Math.min(20, MAX_MESSAGES - 1);

type AsistenteChatProps = {
  usedTokens: number;
  tokenLimit: number;
};

function assistantText(message: UiMessage): string {
  if (message.role !== "assistant") return message.content;
  return message.segments
    .filter((s) => s.kind === "text")
    .map((s) => s.text)
    .join("");
}

export default function AsistenteChat({ usedTokens, tokenLimit }: AsistenteChatProps) {
  const t = useTranslations("AsistenciaIA");
  const tErr = useTranslations("Errors");

  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [used, setUsed] = useState(usedTokens);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Follow the stream: stick to the bottom as content arrives.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || streaming) return;

      setErrorKey(null);
      setStreaming(true);

      const history = [...messages, { role: "user" as const, content }];
      setMessages([
        ...history,
        { role: "assistant", segments: [], streaming: true },
      ]);

      const payload = {
        messages: history
          .map((m) =>
            m.role === "user"
              ? { role: "user" as const, content: m.content }
              : { role: "assistant" as const, content: assistantText(m) }
          )
          // An aborted/failed turn can leave an empty assistant message;
          // the API rejects empty content, so drop those from the history.
          .filter((m) => m.content.trim().length > 0)
          .slice(-1 - HISTORY_LIMIT),
      };

      const controller = new AbortController();
      abortRef.current = controller;

      const appendToAssistant = (apply: (segments: AssistantSegment[]) => void) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role !== "assistant") return prev;
          const segments: AssistantSegment[] = last.segments.map((s) => ({ ...s }));
          apply(segments);
          next[next.length - 1] = { ...last, segments };
          return next;
        });
      };

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          let key = "ai_unavailable";
          try {
            const data = await res.json();
            if (typeof data?.error === "string") key = data.error;
          } catch {
            // Non-JSON failure body; keep the generic key.
          }
          setErrorKey(key);
          return;
        }

        const parser = createNdjsonParser((event) => {
          if (event.type === "text") {
            appendToAssistant((segments) => {
              const last = segments[segments.length - 1];
              if (last?.kind === "text") last.text += event.delta;
              else segments.push({ kind: "text", text: event.delta });
            });
          } else if (event.type === "tool") {
            appendToAssistant((segments) =>
              segments.push({ kind: "tool", name: event.name })
            );
          } else if (event.type === "error") {
            setErrorKey(event.key);
          } else if (event.type === "done") {
            setUsed((prev) => prev + event.usage.inputTokens + event.usage.outputTokens);
            if (event.truncated) setErrorKey("ai_response_truncated");
          }
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          parser.push(decoder.decode(value, { stream: true }));
        }
        parser.flush();
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setErrorKey("ai_unavailable");
        }
      } finally {
        abortRef.current = null;
        setStreaming(false);
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = { ...last, streaming: false };
          }
          return next;
        });
      }
    },
    [messages, streaming]
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const suggestions = [
    t("suggestion_stock"),
    t("suggestion_expiry"),
    t("suggestion_predictions"),
  ];

  const usagePct = tokenLimit > 0 ? Math.min(100, (used / tokenLimit) * 100) : 0;
  const fmt = (n: number) => n.toLocaleString("es-AR");

  return (
    <div className="flex-1 flex flex-col min-h-0 px-7 py-7 gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-ink leading-tight" style={{ fontSize: 28 }}>
            {t("heading")}
          </h1>
          <p className="text-ink2 mt-1" style={{ fontSize: 14 }}>
            {t("subheading")}
          </p>
        </div>
        <div style={{ minWidth: 220 }}>
          <p className="text-ink3 mb-1" style={{ fontSize: 12 }}>
            {t("usage_meter", { used: fmt(used), limit: fmt(tokenLimit) })}
          </p>
          <div
            className="rounded-full overflow-hidden"
            style={{ height: 6, background: "var(--c-line)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${usagePct}%`,
                background: usagePct >= 90 ? "var(--c-danger)" : "var(--c-primary)",
                transition: "width 300ms ease",
              }}
            />
          </div>
        </div>
      </div>

      {/* Conversation */}
      <div className="mi-card mi-shadow flex-1 flex flex-col min-h-0 overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
              <h2 className="font-display text-ink" style={{ fontSize: 20 }}>
                {t("empty_title")}
              </h2>
              <p className="text-ink3" style={{ fontSize: 13 }}>
                {t("empty_hint")}
              </p>
              <div className="flex flex-wrap justify-center gap-2" style={{ maxWidth: 520 }}>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    className="mi-btn mi-btn--soft"
                    style={{ fontSize: 13 }}
                    onClick={() => send(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => <ChatMessage key={i} message={m} />)
          )}
        </div>

        {errorKey && (
          <p className="mi-field-error px-5 pb-1">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {tErr(errorKey as any)}
          </p>
        )}

        <div className="p-4 border-t" style={{ borderColor: "var(--c-line)" }}>
          <ChatInput streaming={streaming} onSend={send} onStop={stop} />
          <p className="text-ink3 mt-2" style={{ fontSize: 11 }}>
            {t("disclaimer")}
          </p>
        </div>
      </div>
    </div>
  );
}
