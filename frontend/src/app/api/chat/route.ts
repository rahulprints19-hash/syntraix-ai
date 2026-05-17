import { NextRequest } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

import { buildSystemPrompt } from "@/lib/ai";
import { env, requireEnv } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/security";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const chatSchema = z.object({
  chatId: z.string().uuid().nullable().optional(),
  fileContext: z.string().nullable().optional(),
  messages: z.array(z.object({ content: z.string(), role: z.enum(["user", "assistant"]) })).min(1),
  model: z.string().min(2).max(80)
});

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!checkRateLimit(user.id, 20, 60_000)) {
    return Response.json({ error: "Rate limit exceeded. Try again soon." }, { status: 429 });
  }

  const payload = chatSchema.parse(await request.json());
  const userMessage = sanitizeText(payload.messages[payload.messages.length - 1].content);
  const title = userMessage.slice(0, 80) || "New chat";
  let chatId = payload.chatId;

  if (!chatId) {
    const { data, error } = await supabase
      .from("chat_history")
      .insert({ title, user_id: user.id })
      .select("id")
      .single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    chatId = data.id;
  }

  await supabase.from("messages").insert({
    chat_id: chatId,
    content: userMessage,
    role: "user",
    user_id: user.id
  });

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

        await supabase.from("messages").insert({
          chat_id: chatId,
          content: assistantText,
          role: "assistant",
          user_id: user.id
        });
        await supabase.from("ai_usage").insert({
          chat_id: chatId,
          model: payload.model,
          tokens: Math.ceil((assistantText.length + userMessage.length) / 4),
          user_id: user.id
        });
        await supabase.from("chat_history").update({ updated_at: new Date().toISOString() }).eq("id", chatId);
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
