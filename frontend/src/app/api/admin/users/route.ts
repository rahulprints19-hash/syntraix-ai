import { requireAdmin } from "@/lib/auth";

export async function GET() {
  await requireAdmin();

  return Response.json({ users: [] });
}

export async function PATCH() {
  await requireAdmin();

  return Response.json({ ok: true });
}
