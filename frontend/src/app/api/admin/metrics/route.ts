import { requireAdmin } from "@/lib/auth";
import { getMemoryStore } from "@/lib/memory-store";

export async function GET() {
  await requireAdmin();
  const store = getMemoryStore();
  const users = new Set(store.chats.map((chat) => chat.user_id));

  return Response.json({
    activeSubscriptions: 0,
    revenue: 0,
    tokens: store.usageTokens,
    users: users.size
  });
}
