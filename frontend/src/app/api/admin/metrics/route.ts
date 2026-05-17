import { createSupabaseServerClient } from "@/lib/supabase/server";

async function assertAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", supabase, user: null };

  const { data: profile } = await supabase.from("users").select("role,status").eq("id", user.id).single();
  if (profile?.role !== "admin" || profile.status === "banned") {
    return { error: "Forbidden", supabase, user: null };
  }
  return { error: null, supabase, user };
}

export async function GET() {
  const { error, supabase } = await assertAdmin();
  if (error) return Response.json({ error }, { status: error === "Unauthorized" ? 401 : 403 });

  const [{ count: users }, { count: activeSubscriptions }, { data: payments }, { data: usage }] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("payments").select("amount,status").eq("status", "captured"),
    supabase.from("ai_usage").select("tokens")
  ]);

  const revenue = (payments ?? []).reduce((total, item) => total + Number(item.amount ?? 0), 0);
  const tokens = (usage ?? []).reduce((total, item) => total + Number(item.tokens ?? 0), 0);

  return Response.json({
    activeSubscriptions: activeSubscriptions ?? 0,
    revenue,
    tokens,
    users: users ?? 0
  });
}
