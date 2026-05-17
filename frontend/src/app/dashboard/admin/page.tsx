import Link from "next/link";

import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { getMemoryStore } from "@/lib/memory-store";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const store = getMemoryStore();
  const users = new Set(store.chats.map((chat) => chat.user_id));

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <Link className="text-sm text-cyan-200" href="/dashboard">Back to dashboard</Link>
        <h1 className="mt-6 text-4xl font-semibold text-white">Admin panel</h1>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {[
            ["Users", users.size],
            ["Chats", store.chats.length],
            ["API keys", store.apiKeys.length],
            ["AI tokens", store.usageTokens.toLocaleString("en-IN")]
          ].map(([label, value]) => (
            <Card key={label}>
              <p className="text-sm text-slate-400">{label}</p>
              <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
            </Card>
          ))}
        </div>
        <Card className="mt-6">
          <h2 className="text-xl font-semibold text-white">No database mode</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Supabase has been removed. Admin stats are kept in memory and reset when the Render free instance restarts.
          </p>
        </Card>
      </div>
    </main>
  );
}
