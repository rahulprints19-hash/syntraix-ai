"use client";

import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { SessionUser } from "@/types/workspace";

import { AuthScreen } from "@/components/auth-screen";
import { WorkspaceShell } from "@/components/workspace-shell";

export function AppShell() {
  const [hydrated, setHydrated] = useState(false);
  const token = useWorkspaceStore((state) => state.token);
  const user = useWorkspaceStore((state) => state.user);
  const setSession = useWorkspaceStore((state) => state.setSession);
  const clearSession = useWorkspaceStore((state) => state.clearSession);

  useEffect(() => {
    const storedToken = localStorage.getItem("syntrix-token");
    const storedUser = localStorage.getItem("syntrix-user");

    if (storedToken && storedUser) {
      try {
        setSession(storedToken, JSON.parse(storedUser) as SessionUser);
      } catch {
        localStorage.removeItem("syntrix-token");
        localStorage.removeItem("syntrix-user");
      }
    }

    setHydrated(true);
  }, [setSession]);

  useEffect(() => {
    if (!token) {
      return;
    }

    void apiRequest<SessionUser>("/auth/me", {}, token).catch(() => {
      clearSession();
      localStorage.removeItem("syntrix-token");
      localStorage.removeItem("syntrix-user");
    });
  }, [clearSession, token]);

  if (!hydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-slate-300">
        Loading Syntrix AI...
      </main>
    );
  }

  if (!token || !user) {
    return <AuthScreen />;
  }

  return <WorkspaceShell />;
}
