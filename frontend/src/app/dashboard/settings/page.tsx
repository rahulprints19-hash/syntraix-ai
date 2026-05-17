import Link from "next/link";

import { SettingsPanel } from "@/components/dashboard/settings-panel";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase.from("users").select("plan_code").eq("id", user.id).single();

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <Link className="text-sm text-cyan-200" href="/dashboard">Back to dashboard</Link>
        <h1 className="mt-6 text-4xl font-semibold text-white">Settings</h1>
        <p className="mt-2 text-slate-400">Manage account, subscription, API keys, and preferences.</p>
        <div className="mt-8">
          <SettingsPanel email={user.email ?? ""} plan={profile?.plan_code ?? "free"} />
        </div>
      </div>
    </main>
  );
}
