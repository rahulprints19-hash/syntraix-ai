import { requireUser } from "@/lib/auth";
import { chatBelongsToUser, listMessages } from "@/lib/memory-store";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const user = await requireUser();

  if (!chatBelongsToUser(user.id, id)) {
    return Response.json({ error: "Chat not found" }, { status: 404 });
  }

  return Response.json({ messages: listMessages(user.id, id) });
}
