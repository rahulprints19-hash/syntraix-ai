"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Globe2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "login" | "register" | "forgot";

function getAuthRedirectUrl(nextPath: string) {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
}

function getAuthErrorMessage(error: unknown) {
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return "Could not reach Supabase. Check NEXT_PUBLIC_SUPABASE_URL and your internet connection.";
  }

  return error instanceof Error ? error.message : "Authentication failed.";
}

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
        ? "Start with a free workspace and upgrade when you grow."
        : "We will send a secure reset link to your email.";

  async function submit() {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      if (mode === "login") {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        if (loginError) throw loginError;
        router.replace("/dashboard");
      }

      if (mode === "register") {
        const { error: registerError } = await supabase.auth.signUp({
          email,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: getAuthRedirectUrl("/verify-email")
          },
          password
        });
        if (registerError) throw registerError;
        setMessage("Check your inbox to verify your email.");
      }

      if (mode === "forgot") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: getAuthRedirectUrl("/dashboard/settings")
        });
        if (resetError) throw resetError;
        setMessage("Password reset link sent.");
      }
    } catch (nextError) {
      setError(getAuthErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        options: { redirectTo: getAuthRedirectUrl("/dashboard") },
        provider: "google"
      });
      if (googleError) throw googleError;
    } catch (nextError) {
      setError(getAuthErrorMessage(nextError));
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
        {mode !== "forgot" ? (
          <Button className="w-full gap-2" disabled={loading} onClick={signInWithGoogle} variant="secondary">
            <Globe2 className="size-4" />
            Continue with Google
          </Button>
        ) : null}
      </div>

      <div className="mt-5 flex items-center justify-between text-sm text-slate-400">
        {mode === "login" ? <Link href="/forgot-password">Forgot password?</Link> : <Link href="/login">Sign in</Link>}
        {mode === "login" ? <Link href="/register">Create account</Link> : null}
      </div>
    </Card>
  );
}
