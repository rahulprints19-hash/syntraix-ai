import { NextRequest } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

import { buildSystemPrompt } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { env, requireEnv } from "@/lib/env";
import { addMessage, addUsageTokens, createChat } from "@/lib/memory-store";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/security";

export const runtime = "nodejs";

const chatSchema = z.object({
  chatId: z.string().uuid().nullable().optional(),
  fileContext: z.string().nullable().optional(),
  messages: z.array(z.object({ content: z.string(), role: z.enum(["user", "assistant"]) })).min(1),
  model: z.string().min(2).max(80)
});

export async function POST(request: NextRequest) {
  const user = await requireUser();

  if (!checkRateLimit(user.id, 20, 60_000)) {
    return Response.json({ error: "Rate limit exceeded. Try again soon." }, { status: 429 });
  }

  const payload = chatSchema.parse(await request.json());
  const userMessage = sanitizeText(payload.messages[payload.messages.length - 1].content);
  const title = userMessage.slice(0, 80) || "New chat";
  let chatId = payload.chatId;

  if (!chatId) {
    chatId = createChat(user.id, title).id;
  }

  addMessage(user.id, chatId, "user", userMessage);

  const memories = payload.messages
    .slice(-8)
    .map((message) => `${message.role}: ${sanitizeText(message.content, 2000)}`);
  if (payload.fileContext) {
    memories.push(`file_context: ${sanitizeText(payload.fileContext, 12000)}`);
  }

  const openai = new OpenAI({ apiKey: requireEnv(env.OPENAI_API_KEY, "OPENAI_API_KEY") });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let assistantText = "";
      controller.enqueue(encoder.encode(`[[CHAT_ID:${chatId}]]`));

      try {
        const completion = await openai.chat.completions.create({
          messages: [
            { content: buildSystemPrompt(memories), role: "system" },
            ...payload.messages.map((message) => ({
              content: sanitizeText(message.content),
              role: message.role
            }))
          ],
          model: payload.model || env.OPENAI_DEFAULT_MODEL,
          stream: true,
          temperature: 0.7
        });

        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          assistantText += delta;
          controller.enqueue(encoder.encode(delta));
        }

        addMessage(user.id, chatId, "assistant", assistantText);
        addUsageTokens(Math.ceil((assistantText.length + userMessage.length) / 4));
      } catch (error) {
        controller.enqueue(encoder.encode(error instanceof Error ? `\n\n${error.message}` : "\n\nAI request failed."));
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "cache-control": "no-cache",
      "content-type": "text/plain; charset=utf-8"
    }
  });
}
