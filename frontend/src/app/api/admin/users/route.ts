import { NextRequest } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  status: z.enum(["active", "banned", "suspended"]),
  userId: z.string().uuid()
});

async function assertAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", supabase };

  const { data: profile } = await supabase.from("users").select("role,status").eq("id", user.id).single();
  if (profile?.role !== "admin" || profile.status === "banned") {
    return { error: "Forbidden", supabase };
  }
  return { error: null, supabase };
}

export async function GET() {
  const { error, supabase } = await assertAdmin();
  if (error) return Response.json({ error }, { status: error === "Unauthorized" ? 401 : 403 });

  const { data, error: queryError } = await supabase
    .from("users")
    .select("id,email,full_name,role,status,plan_code,created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (queryError) {
    return Response.json({ error: queryError.message }, { status: 500 });
  }

  return Response.json({ users: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const { error, supabase } = await assertAdmin();
  if (error) return Response.json({ error }, { status: error === "Unauthorized" ? 401 : 403 });

  const payload = updateSchema.parse(await request.json());
  const { error: updateError } = await supabase
    .from("users")
    .update({ status: payload.status })
    .eq("id", payload.userId);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  await supabase.from("admin_logs").insert({
    action: "user_status_updated",
    metadata: { status: payload.status, targetUserId: payload.userId }
  });

  return Response.json({ ok: true });
}
