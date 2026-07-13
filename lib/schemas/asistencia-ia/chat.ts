import { z } from "zod";

// Request body for POST /api/ai/chat. Conversations are ephemeral: the
// client resends its (trimmed) history each turn, so caps here bound the
// request size, not what the user can ever say.
export const MAX_MESSAGE_CHARS = 4000;
export const MAX_MESSAGES = 30;

export const ChatRequestSchema = z
  .object({
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
        })
      )
      .min(1)
      .max(MAX_MESSAGES),
  })
  // Zod v4 runs refinements even when earlier checks failed, so guard
  // against an empty array instead of assuming .min(1) already rejected it.
  .refine((body) => body.messages[body.messages.length - 1]?.role === "user", {
    message: "last_must_be_user",
  });

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
