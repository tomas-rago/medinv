import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ChatRequestSchema } from "@/lib/schemas/asistencia-ia/chat";
import { CHAT_SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { CHAT_TOOLS } from "@/lib/ai/tools";
import { runAssistantTurn } from "@/lib/ai/chat";
import {
  getOrgMonthlyConsumption,
  getTokenLimit,
  isOverQuota,
  recordTokenUsage,
} from "@/lib/ai/quota";
import { encodeEvent, type ChatStreamEvent } from "@/lib/ai/wire";

export const dynamic = "force-dynamic";

// Pre-stream failures return JSON { ok: false, error: <Errors key> } with a
// status code; once the model turn starts, everything (including errors)
// travels as NDJSON events on a 200. The client switches on Content-Type.
const jsonError = (key: string, status: number) =>
  Response.json({ ok: false, error: key }, { status });

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("not_authenticated", 401);

  const orgId = user.app_metadata?.organization_id as string | undefined;
  if (!orgId) return jsonError("no_ai_access", 403);

  // limit > 0 is exactly the hasAiAccess condition; the number is also
  // needed for the quota check, so one query serves both.
  const limit = await getTokenLimit(supabase, orgId);
  if (limit <= 0) return jsonError("no_ai_access", 403);

  if (!process.env.ANTHROPIC_API_KEY) return jsonError("ai_unavailable", 500);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("ai_invalid_request", 400);
  }
  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) return jsonError("ai_invalid_request", 400);

  const admin = createAdminClient();
  const used = await getOrgMonthlyConsumption(admin, orgId);
  if (isOverQuota(used, limit)) return jsonError("ai_quota_exceeded", 429);

  // The system prompt is byte-stable for caching, so the current date (needed
  // for expiry/reorder reasoning) rides on the last user message instead.
  const today = new Date().toISOString().slice(0, 10);
  const history = parsed.data.messages;
  const messages: Anthropic.MessageParam[] = history.map((m, i) => ({
    role: m.role,
    content:
      i === history.length - 1 ? `[Fecha actual: ${today}]\n${m.content}` : m.content,
  }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: ChatStreamEvent) => {
        try {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        } catch {
          // Client went away mid-stream; keep running so usage still lands.
        }
      };

      // Mutated in place by runAssistantTurn, so partial consumption is
      // metered even when the turn aborts or throws mid-loop.
      const usage = { inputTokens: 0, outputTokens: 0 };
      try {
        const result = await runAssistantTurn({
          supabase,
          messages,
          system: CHAT_SYSTEM_PROMPT,
          tools: CHAT_TOOLS,
          emit,
          signal: req.signal,
          usageOut: usage,
        });
        emit({ type: "done", usage, ...(result.truncated ? { truncated: true } : {}) });
      } catch (err) {
        console.error("[ai/chat] turn failed:", err);
        emit({ type: "error", key: "ai_unavailable" });
      } finally {
        // Meter whatever was consumed, even on abort or mid-turn failure.
        if (usage.inputTokens + usage.outputTokens > 0) {
          await recordTokenUsage(admin, {
            organizationId: orgId,
            userId: user.id,
            ...usage,
          }).catch((err) => console.error("[ai/chat] metering failed:", err));
        }
        try {
          controller.close();
        } catch {
          // Already closed (client disconnect).
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
