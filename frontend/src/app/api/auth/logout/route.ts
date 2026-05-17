import { signOutDemoUser } from "@/lib/demo-auth";

export async function POST() {
  await signOutDemoUser();

  return Response.json({ ok: true });
}
