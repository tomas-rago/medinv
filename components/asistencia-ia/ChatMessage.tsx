"use client";

import { useTranslations } from "next-intl";
import type { ChatToolName } from "@/lib/ai/wire";

export type AssistantSegment =
  | { kind: "text"; text: string }
  | { kind: "tool"; name: ChatToolName };

export type UiMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; segments: AssistantSegment[]; streaming?: boolean };

const TOOL_LABEL_KEYS: Record<ChatToolName, string> = {
  get_stock_levels: "tool_get_stock_levels",
  get_alerts: "tool_get_alerts",
  get_predictions: "tool_get_predictions",
  get_product_prediction_detail: "tool_get_product_prediction_detail",
};

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    >
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

export default function ChatMessage({ message }: { message: UiMessage }) {
  const t = useTranslations("AsistenciaIA");

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          className="rounded-2xl px-4 py-2.5 whitespace-pre-wrap"
          style={{
            maxWidth: "78%",
            fontSize: 14,
            background: "color-mix(in srgb, var(--c-primary) 12%, var(--c-surface))",
            color: "var(--c-ink)",
            borderBottomRightRadius: 6,
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  const isEmpty = message.segments.length === 0;

  return (
    <div className="flex justify-start">
      <div
        className="rounded-2xl px-4 py-2.5 border"
        style={{
          maxWidth: "78%",
          fontSize: 14,
          background: "var(--c-surface)",
          borderColor: "var(--c-line)",
          borderBottomLeftRadius: 6,
        }}
      >
        {isEmpty && message.streaming && (
          <span className="flex items-center gap-2 text-ink3" style={{ fontSize: 13 }}>
            <Spinner />
            {t("assistant_thinking")}
          </span>
        )}
        {message.segments.map((segment, i) => {
          if (segment.kind === "tool") {
            // The last segment of an in-flight message is the one still
            // running; earlier tool chips are finished.
            const active = message.streaming && i === message.segments.length - 1;
            return (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 my-1 mr-1.5 text-ink2"
                style={{
                  fontSize: 12,
                  background: "color-mix(in srgb, var(--c-primary) 8%, var(--c-surface))",
                  border: "1px solid var(--c-line)",
                }}
              >
                {active ? (
                  <Spinner />
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
                {t(TOOL_LABEL_KEYS[segment.name])}
              </span>
            );
          }
          return (
            <span key={i} className="whitespace-pre-wrap text-ink">
              {segment.text}
            </span>
          );
        })}
        {!isEmpty && message.streaming && (
          <span
            className="inline-block align-baseline ml-0.5"
            style={{
              width: 7,
              height: 14,
              background: "var(--c-primary)",
              animation: "pulse 1s ease-in-out infinite",
            }}
          />
        )}
      </div>
    </div>
  );
}
