"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MAX_MESSAGE_CHARS } from "@/lib/schemas/asistencia-ia/chat";

type ChatInputProps = {
  streaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
};

export default function ChatInput({ streaming, onSend, onStop }: ChatInputProps) {
  const t = useTranslations("AsistenciaIA");
  const [value, setValue] = useState("");

  const submit = () => {
    const text = value.trim();
    if (!text || streaming) return;
    setValue("");
    onSend(text);
  };

  return (
    <div className="flex items-end gap-2">
      <textarea
        className="mi-input flex-1"
        style={{ resize: "none", minHeight: 44, maxHeight: 140 }}
        rows={1}
        maxLength={MAX_MESSAGE_CHARS}
        placeholder={t("input_placeholder")}
        value={value}
        disabled={streaming}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />
      {streaming ? (
        <button className="mi-btn mi-btn--soft" onClick={onStop}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
          {t("stop")}
        </button>
      ) : (
        <button
          className="mi-btn mi-btn--primary"
          disabled={!value.trim()}
          onClick={submit}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m22 2-7 20-4-9-9-4z" />
            <path d="M22 2 11 13" />
          </svg>
          {t("send")}
        </button>
      )}
    </div>
  );
}
