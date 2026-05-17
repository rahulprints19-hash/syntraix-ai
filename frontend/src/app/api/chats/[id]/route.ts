import { NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { deleteChat, renameChat } from "@/lib/memory-store";
import { sanitizeText } from "@/lib/security";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const renameSchema = z.object({
  title: z.string().min(1).max(120)
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const user = await requireUser();

  const payload = renameSchema.parse(await request.json());
  const chat = renameChat(user.id, id, sanitizeText(payload.title, 120));

  if (!chat) {
    return Response.json({ error: "Chat not found" }, { status: 404 });
  }

  return Response.json({ chat });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const user = await requireUser();
  deleteChat(user.id, id);

  return Response.json({ ok: true });
}
