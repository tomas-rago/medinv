// Pure tests for the NDJSON wire format — no credentials needed.
//
//   npx vitest run tests/ai
//
import { describe, it, expect } from "vitest";
import { createNdjsonParser, encodeEvent, type ChatStreamEvent } from "@/lib/ai/wire";

function collect() {
  const events: ChatStreamEvent[] = [];
  const parser = createNdjsonParser((e) => events.push(e));
  return { events, parser };
}

describe("encodeEvent / createNdjsonParser", () => {
  it("round-trips every event type", () => {
    const sent: ChatStreamEvent[] = [
      { type: "text", delta: "hola\ncon salto" },
      { type: "tool", name: "get_stock_levels" },
      { type: "done", usage: { inputTokens: 100, outputTokens: 50 }, truncated: true },
      { type: "error", key: "ai_unavailable" },
    ];
    const { events, parser } = collect();
    parser.push(sent.map(encodeEvent).join(""));
    expect(events).toEqual(sent);
  });

  it("handles a line split across arbitrary chunk boundaries", () => {
    const encoded = encodeEvent({ type: "text", delta: "fragmento largo" });
    const { events, parser } = collect();
    for (const char of encoded) parser.push(char);
    expect(events).toEqual([{ type: "text", delta: "fragmento largo" }]);
  });

  it("handles several lines arriving in one chunk plus a trailing partial", () => {
    const first = encodeEvent({ type: "text", delta: "a" });
    const second = encodeEvent({ type: "tool", name: "get_alerts" });
    const partial = encodeEvent({ type: "done", usage: { inputTokens: 1, outputTokens: 2 } });
    const { events, parser } = collect();
    parser.push(first + second + partial.slice(0, 10));
    expect(events).toHaveLength(2);
    parser.push(partial.slice(10));
    expect(events).toHaveLength(3);
  });

  it("flush surfaces an unterminated final line and skips malformed ones", () => {
    const { events, parser } = collect();
    parser.push('{"type":"text","delta":"sin salto"}'); // no trailing \n
    expect(events).toHaveLength(0);
    parser.flush();
    expect(events).toEqual([{ type: "text", delta: "sin salto" }]);

    parser.push('not json at all\n{"type":"text","delta":"ok"}\n');
    expect(events).toHaveLength(2);
    expect(events[1]).toEqual({ type: "text", delta: "ok" });
  });
});
