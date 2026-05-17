import { NextRequest } from "next/server";

import { requireUser } from "@/lib/auth";
import { createStoredApiKey, listApiKeys } from "@/lib/memory-store";

export async function GET() {
  const user = await requireUser();

  return Response.json({ keys: listApiKeys(user.id) });
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const { name = "Production key" } = await request.json().catch(() => ({}));

  return Response.json(createStoredApiKey(user.id, String(name)));
}
