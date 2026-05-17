import Link from "next/link";

import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const [{ count: users }, { count: activeSubscriptions }, { data: payments }, { data: usage }, { data: latestUsers }] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("payments").select("amount,status").eq("status", "captured"),
    supabase.from("ai_usage").select("tokens,model").limit(1000),
    supabase.from("users").select("id,email,full_name,role,status,plan_code,created_at").order("created_at", { ascending: false }).limit(20)
  ]);
  const revenue = payments?.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0) ?? 0;
  const tokens = usage?.reduce((sum, event) => sum + Number(event.tokens ?? 0), 0) ?? 0;

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <Link className="text-sm text-cyan-200" href="/dashboard">Back to dashboard</Link>
        <h1 className="mt-6 text-4xl font-semibold text-white">Admin panel</h1>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {[
            ["Users", users ?? 0],
            ["Active subscriptions", activeSubscriptions ?? 0],
            ["Revenue", `Rs. ${(revenue / 100).toLocaleString("en-IN")}`],
            ["AI tokens", tokens.toLocaleString("en-IN")]
          ].map(([label, value]) => (
            <Card key={label}>
              <p className="text-sm text-slate-400">{label}</p>
              <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
            </Card>
          ))}
        </div>
        <Card className="mt-6 overflow-auto">
          <h2 className="text-xl font-semibold text-white">User management</h2>
          <table className="mt-5 w-full min-w-[760px] text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="py-2">User</th>
                <th>Plan</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody className="text-slate-200">
              {latestUsers?.map((user) => (
                <tr key={user.id} className="border-t border-white/10">
                  <td className="py-3">{user.full_name ?? user.email}</td>
                  <td>{user.plan_code}</td>
                  <td>{user.role}</td>
                  <td>{user.status}</td>
                  <td>{new Date(user.created_at).toLocaleDateString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </main>
  );
}
