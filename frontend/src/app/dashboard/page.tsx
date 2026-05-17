import Link from "next/link";
import { CreditCard, Settings, Shield } from "lucide-react";

import { ChatInterface } from "@/components/chat/chat-interface";
import { buttonClassName } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase.from("users").select("full_name,plan_code,role").eq("id", user.id).single();

  return (
    <main className="min-h-screen p-4">
      <header className="mb-4 flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">Syntrix AI</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400">{profile?.full_name ?? user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={buttonClassName({ variant: "secondary" })} href="/pricing"><CreditCard className="mr-2 size-4" />Pricing</Link>
          <Link className={buttonClassName({ variant: "secondary" })} href="/dashboard/settings"><Settings className="mr-2 size-4" />Settings</Link>
          {profile?.role === "admin" ? (
            <Link className={buttonClassName({ variant: "secondary" })} href="/dashboard/admin"><Shield className="mr-2 size-4" />Admin</Link>
          ) : null}
        </div>
      </header>
      <ChatInterface initialPlan={profile?.plan_code ?? "free"} />
    </main>
  );
}
