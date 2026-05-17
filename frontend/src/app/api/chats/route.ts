import { NextRequest } from "next/server";

import { requireUser } from "@/lib/auth";
import { createChat, listChats } from "@/lib/memory-store";

export async function GET() {
  const user = await requireUser();
  return Response.json({ chats: listChats(user.id) });
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const { title = "New chat" } = await request.json().catch(() => ({}));
  return Response.json({ chat: createChat(user.id, String(title)) });
}
