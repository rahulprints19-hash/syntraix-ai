import { requireUser } from "@/lib/auth";
import { setUserPlan } from "@/lib/memory-store";

export const runtime = "nodejs";

export async function POST() {
  const user = await requireUser();
  setUserPlan(user.id, "free");

  return Response.json({ ok: true });
}
