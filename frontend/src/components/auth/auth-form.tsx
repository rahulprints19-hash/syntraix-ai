"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AuthMode = "login" | "register" | "forgot";

export function AuthForm({ initialError, mode }: { initialError?: string; mode: AuthMode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(false);

  const title = mode === "login" ? "Welcome back" : mode === "register" ? "Create your account" : "Reset password";
  const subtitle =
    mode === "login"
      ? "Sign in to continue your Syntrix AI workspace."
      : mode === "register"
        ? "Start with a free workspace. No Supabase setup required."
        : "Enter your email and we will reset the demo password locally.";

  async function submit() {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : mode === "register" ? "/api/auth/register" : "/api/auth/reset";
      const response = await fetch(endpoint, {
        body: JSON.stringify({ email, fullName, password }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Authentication failed.");

      if (mode === "login") {
        router.replace("/dashboard");
      }

      if (mode === "register") {
        router.replace("/dashboard");
      }

      if (mode === "forgot") {
        setMessage(payload.message ?? "Password reset for demo auth.");
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md p-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">Syntrix AI</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">{subtitle}</p>
      </div>

      <div className="mt-6 space-y-3">
        {mode === "register" ? (
          <Input autoComplete="name" onChange={(event) => setFullName(event.target.value)} placeholder="Full name" value={fullName} />
        ) : null}
        <Input autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="Email address" type="email" value={email} />
        {mode !== "forgot" ? (
          <Input
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            type="password"
            value={password}
          />
        ) : null}
      </div>

      {error ? <p className="mt-4 rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</p> : null}
      {message ? <p className="mt-4 rounded-lg border border-cyan-300/30 bg-cyan-300/10 p-3 text-sm text-cyan-100">{message}</p> : null}

      <div className="mt-6 space-y-3">
        <Button className="w-full" disabled={loading || !email || (mode !== "forgot" && !password)} onClick={submit}>
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          {mode === "login" ? "Sign in" : mode === "register" ? "Create account" : "Send reset link"}
        </Button>
      </div>

      <div className="mt-5 flex items-center justify-between text-sm text-slate-400">
        {mode === "login" ? <Link href="/forgot-password">Forgot password?</Link> : <Link href="/login">Sign in</Link>}
        {mode === "login" ? <Link href="/register">Create account</Link> : null}
      </div>
    </Card>
  );
}
