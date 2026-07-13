import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { executeTool } from "./tools";
import type { ChatStreamEvent, ChatToolName } from "./wire";
import type { TurnUsage } from "./quota";

// Streaming tool-use loop shared by the chat route today and the future
// "explain" route (module 6): callers supply their own system prompt,
// message history and tool set; this owns the Anthropic loop, event
// emission and usage accounting.

export const CHAT_MODEL = "claude-opus-4-8";
const MAX_TOKENS_PER_ITERATION = 8192;
// Each iteration is one API round trip; a well-behaved turn uses 1-3.
const MAX_TOOL_ITERATIONS = 8;

export type AssistantTurnResult = TurnUsage & {
  stopReason: string | null;
  truncated: boolean;
};

export async function runAssistantTurn(opts: {
  supabase: SupabaseClient<Database>;
  messages: Anthropic.MessageParam[];
  system: string;
  tools: Anthropic.Tool[];
  emit: (event: ChatStreamEvent) => void;
  signal?: AbortSignal;
  // Mutated as each iteration completes, so the caller can meter partial
  // consumption even when the turn aborts or throws mid-loop.
  usageOut?: TurnUsage;
}): Promise<AssistantTurnResult> {
  const { supabase, system, tools, emit, signal } = opts;
  const messages = [...opts.messages];
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY

  // Counting rule: see lib/ai/quota.ts — cache reads/writes count 1:1.
  const usage: TurnUsage = opts.usageOut ?? { inputTokens: 0, outputTokens: 0 };
  let stopReason: string | null = null;
  let truncated = false;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const stream = client.messages.stream(
      {
        model: CHAT_MODEL,
        max_tokens: MAX_TOKENS_PER_ITERATION,
        thinking: { type: "adaptive" },
        // Tools render before system, so this single breakpoint caches both.
        system: [
          { type: "text", text: system, cache_control: { type: "ephemeral" } },
        ],
        tools,
        messages,
      },
      { signal }
    );
    stream.on("text", (delta) => emit({ type: "text", delta }));

    const message = await stream.finalMessage();
    usage.inputTokens +=
      message.usage.input_tokens +
      (message.usage.cache_creation_input_tokens ?? 0) +
      (message.usage.cache_read_input_tokens ?? 0);
    usage.outputTokens += message.usage.output_tokens;
    stopReason = message.stop_reason;

    if (message.stop_reason === "tool_use") {
      // Full content back (thinking blocks included — required for replay).
      messages.push({ role: "assistant", content: message.content });

      const toolUses = message.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );
      for (const tool of toolUses) {
        emit({ type: "tool", name: tool.name as ChatToolName });
      }
      const results = await Promise.all(
        toolUses.map(
          async (tool): Promise<Anthropic.ToolResultBlockParam> => {
            const { content, isError } = await executeTool(
              supabase,
              tool.name,
              tool.input
            );
            return {
              type: "tool_result",
              tool_use_id: tool.id,
              content,
              is_error: isError,
            };
          }
        )
      );
      // All results in ONE user message — splitting them degrades parallel
      // tool use on future turns.
      messages.push({ role: "user", content: results });
      continue;
    }

    if (message.stop_reason === "refusal") {
      emit({ type: "error", key: "ai_refusal" });
    } else if (message.stop_reason === "max_tokens") {
      truncated = true;
    }
    return { ...usage, stopReason, truncated };
  }

  // Still asking for tools after the cap — degenerate loop; end the turn.
  emit({ type: "error", key: "ai_tool_loop_limit" });
  return { ...usage, stopReason, truncated };
}
