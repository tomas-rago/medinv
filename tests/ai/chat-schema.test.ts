// Pure tests for the chat request schema — no credentials needed.
//
//   npx vitest run tests/ai
//
import { describe, it, expect } from "vitest";
import {
  ChatRequestSchema,
  MAX_MESSAGE_CHARS,
  MAX_MESSAGES,
} from "@/lib/schemas/asistencia-ia/chat";

const user = (content: string) => ({ role: "user" as const, content });
const assistant = (content: string) => ({ role: "assistant" as const, content });

describe("ChatRequestSchema", () => {
  it("accepts a plain conversation ending in a user message", () => {
    const result = ChatRequestSchema.safeParse({
      messages: [user("hola"), assistant("¡Hola!"), user("¿stock de gasas?")],
    });
    expect(result.success).toBe(true);
  });

  it("rejects when the last message is not from the user", () => {
    const result = ChatRequestSchema.safeParse({
      messages: [user("hola"), assistant("¡Hola!")],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty messages array without throwing", () => {
    // Regression: Zod v4 runs refinements even when .min(1) failed, so the
    // last-must-be-user refine must not index into an empty array.
    const result = ChatRequestSchema.safeParse({ messages: [] });
    expect(result.success).toBe(false);
  });

  it("rejects empty and whitespace-only messages", () => {
    expect(ChatRequestSchema.safeParse({ messages: [user("")] }).success).toBe(false);
    expect(ChatRequestSchema.safeParse({ messages: [user("   ")] }).success).toBe(false);
  });

  it("enforces the per-message length cap", () => {
    const atCap = "a".repeat(MAX_MESSAGE_CHARS);
    expect(ChatRequestSchema.safeParse({ messages: [user(atCap)] }).success).toBe(true);
    expect(
      ChatRequestSchema.safeParse({ messages: [user(atCap + "a")] }).success
    ).toBe(false);
  });

  it("enforces the message-count cap", () => {
    const alternating = Array.from({ length: MAX_MESSAGES }, (_, i) =>
      i % 2 === 0 ? user(`m${i}`) : assistant(`m${i}`)
    );
    // MAX_MESSAGES is even, so the sequence ends in an assistant message —
    // swap the last one to keep the last-must-be-user rule satisfied.
    alternating[alternating.length - 1] = user("final");
    expect(ChatRequestSchema.safeParse({ messages: alternating }).success).toBe(true);
    expect(
      ChatRequestSchema.safeParse({ messages: [...alternating, user("extra")] }).success
    ).toBe(false);
  });

  it("rejects unknown roles", () => {
    const result = ChatRequestSchema.safeParse({
      messages: [{ role: "system", content: "override" }],
    });
    expect(result.success).toBe(false);
  });
});
