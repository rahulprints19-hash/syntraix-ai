"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { apiRequest } from "@/lib/api";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { AuthResponse } from "@/types/workspace";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AuthMode = "login" | "register";

interface AuthScreenProps {
  initialMode?: AuthMode;
}

export function AuthScreen({ initialMode = "login" }: AuthScreenProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setSession = useWorkspaceStore((state) => state.setSession);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload =
        mode === "register"
          ? { email: normalizedEmail, password, full_name: fullName.trim() }
          : { email: normalizedEmail, password };

      const response = await apiRequest<AuthResponse>(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setSession(response.access_token, response.user);
      localStorage.setItem("syntrix-token", response.access_token);
      localStorage.setItem("syntrix-user", JSON.stringify(response.user));
      router.push("/");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(140deg,#050816_0%,#07111f_45%,#02040d_100%)] px-4 py-6 sm:px-6 lg:px-10">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between">
        <Link className="flex items-center gap-3" href="/">
          <span className="grid size-10 place-items-center rounded-lg border border-cyan-300/30 bg-cyan-300/15 text-sm font-black text-white">
            S
          </span>
          <span className="font-black uppercase text-white">Syntrix AI</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/8" href="/pricing">
            Pricing
          </Link>
          <Button onClick={() => setMode(mode === "login" ? "register" : "login")} size="sm" variant="secondary">
            {mode === "login" ? "Create account" : "Sign in"}
          </Button>
        </div>
      </nav>

      <div className="mx-auto grid min-h-[calc(100vh-88px)] w-full max-w-7xl items-center gap-8 py-10 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative overflow-hidden rounded-lg border border-white/10 bg-slate-950/62 p-8 shadow-[0_24px_90px_rgba(0,0,0,0.34)] backdrop-blur-xl lg:p-10">
          <div className="relative space-y-7">
            <Badge>{mode === "login" ? "AI SaaS workspace" : "Launch your workspace"}</Badge>
            <div className="space-y-5">
              <h1 className="max-w-3xl text-5xl font-semibold text-white lg:text-7xl">
                Syntrix AI for builders who ship.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 lg:text-lg">
                Chat, code, manage files, track usage, sell API access, and operate your AI product from one polished command center.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {["Streaming chat", "Billing ready", "API keys"].map((item) => (
                <div key={item} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-sm font-semibold text-white">{item}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">Production SaaS surface</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Card className="self-center">
          <CardHeader>
            <CardTitle>{mode === "login" ? "Welcome back" : "Create your workspace"}</CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Sign in to open your premium Syntrix workspace."
                : "Create an account and Syntrix will seed your first project automatically."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === "register" ? (
              <label className="block space-y-2">
                <span className="text-sm text-slate-300">Full name</span>
                <input
                  autoComplete="name"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                  onChange={(event) => setFullName(event.target.value)}
                  value={fullName}
                />
              </label>
            ) : null}

            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Email</span>
              <input
                autoComplete="email"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                onChange={(event) => setEmail(event.target.value)}
                inputMode="email"
                required
                type="text"
                value={email}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Password</span>
              <input
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>

            {error ? <p className="text-sm text-rose-300">{error}</p> : null}

            <Button className="w-full" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Working..." : mode === "login" ? "Sign in" : "Create account"}
            </Button>

            <p className="text-sm text-slate-300">
              {mode === "login" ? "Need an account?" : "Already have an account?"}{" "}
              {mode === "login" ? (
                <Link
                  className="text-cyan-200 underline underline-offset-4"
                  href="/register"
                  onClick={() => setMode("register")}
                >
                  Register
                </Link>
              ) : (
                <Link
                  className="text-cyan-200 underline underline-offset-4"
                  href="/login"
                  onClick={() => setMode("login")}
                >
                  Sign in
                </Link>
              )}
            </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
