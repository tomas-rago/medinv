// Wire format between /api/ai/* streaming routes and the browser: one JSON
// event per line (NDJSON) over a plain ReadableStream. Client-safe: no
// server-only imports, so both the route and "use client" components can
// depend on it.

export type ChatToolName =
  | "get_stock_levels"
  | "get_alerts"
  | "get_predictions"
  | "get_product_prediction_detail";

export type ChatStreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; name: ChatToolName }
  | {
      type: "done";
      usage: { inputTokens: number; outputTokens: number };
      truncated?: boolean;
    }
  // key resolves against the flat Errors namespace in messages/es.json.
  | { type: "error"; key: string };

export function encodeEvent(event: ChatStreamEvent): string {
  return JSON.stringify(event) + "\n";
}

// Incremental NDJSON parser: chunks may split a line anywhere, or carry
// several lines at once. Call flush() when the stream ends to surface a
// final unterminated line (defensive; the server always ends lines).
export function createNdjsonParser(onEvent: (event: ChatStreamEvent) => void) {
  let buffer = "";

  const emitLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      onEvent(JSON.parse(trimmed) as ChatStreamEvent);
    } catch {
      // Skip malformed lines rather than killing the stream.
    }
  };

  return {
    push(chunk: string) {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        emitLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
      }
    },
    flush() {
      emitLine(buffer);
      buffer = "";
    },
  };
}
