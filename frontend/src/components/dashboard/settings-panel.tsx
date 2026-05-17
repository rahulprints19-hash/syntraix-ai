"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

type ApiKeyRow = {
  created_at: string;
  id: string;
  key_prefix: string;
  name: string;
};

export function SettingsPanel({ email, plan }: { email: string; plan: string }) {
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [keyName, setKeyName] = useState("Production key");
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/settings/api-keys")
      .then((response) => response.json())
      .then((payload) => setApiKeys(payload.keys ?? []));
  }, []);

  async function updatePassword() {
    setLoading(true);
    const response = await fetch("/api/auth/password", {
      body: JSON.stringify({ password }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    const payload = await response.json().catch(() => ({}));
    setNotice(response.ok ? "Password updated for this demo session." : payload.error ?? "Password update failed.");
    setLoading(false);
    setPassword("");
  }

  async function createKey() {
    const response = await fetch("/api/settings/api-keys", {
      body: JSON.stringify({ name: keyName }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    const payload = await response.json();
    if (response.ok) {
      setCreatedKey(payload.apiKey);
      setApiKeys((current) => [payload.key, ...current]);
    } else {
      setNotice(payload.error ?? "Could not create API key.");
    }
  }

  async function cancelSubscription() {
    const response = await fetch("/api/billing/cancel", { method: "POST" });
    const payload = await response.json();
    setNotice(response.ok ? "Subscription cancellation requested." : payload.error ?? "Cancellation failed.");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="text-xl font-semibold text-white">Profile</h2>
        <p className="mt-2 text-sm text-slate-400">{email}</p>
        <div className="mt-5 space-y-3">
          <Input onChange={(event) => setPassword(event.target.value)} placeholder="New password" type="password" value={password} />
          <Button disabled={loading || password.length < 8} onClick={updatePassword}>
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Change password
          </Button>
        </div>
        {notice ? <p className="mt-4 rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm text-cyan-100">{notice}</p> : null}
      </Card>

      <Card>
        <h2 className="text-xl font-semibold text-white">Subscription</h2>
        <p className="mt-2 text-sm text-slate-400">Current plan: {plan.toUpperCase()}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={() => window.location.assign("/pricing")}>Manage plans</Button>
          <Button onClick={cancelSubscription} variant="secondary">Cancel subscription</Button>
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold text-white">API keys</h2>
        <div className="mt-4 flex gap-2">
          <Input onChange={(event) => setKeyName(event.target.value)} value={keyName} />
          <Button onClick={createKey}><KeyRound className="mr-2 size-4" />Create</Button>
        </div>
        {createdKey ? (
          <pre className="mt-4 overflow-auto rounded-lg bg-slate-950/70 p-3 text-xs text-cyan-100">
            <code>{createdKey}</code>
          </pre>
        ) : null}
        <div className="mt-4 space-y-2">
          {apiKeys.map((key) => (
            <div key={key.id} className="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">
              {key.name} - {key.key_prefix}...
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold text-white">Preferences</h2>
        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Dark mode</span>
            <Switch checked={darkMode} onCheckedChange={setDarkMode} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Email notifications</span>
            <Switch checked={notifications} onCheckedChange={setNotifications} />
          </div>
        </div>
      </Card>
    </div>
  );
}
