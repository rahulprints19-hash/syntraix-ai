import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AUTH_COOKIE } from "@/lib/auth-cookie";

export type DemoUser = {
  email: string;
  id: string;
  role: "admin" | "user";
  user_metadata: {
    full_name?: string;
  };
};

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value.toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

function encodeUser(user: DemoUser) {
  return Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
}

function decodeUser(value: string | undefined): DemoUser | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as DemoUser;
    if (!parsed.email || !parsed.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function createDemoUser(email: string, fullName?: string): Promise<DemoUser> {
  const normalizedEmail = email.trim().toLowerCase();
  const adminEmails = getAdminEmails();

  return {
    email: normalizedEmail,
    id: await digest(normalizedEmail),
    role: adminEmails.includes(normalizedEmail) ? "admin" : "user",
    user_metadata: {
      full_name: fullName?.trim() || normalizedEmail.split("@")[0]
    }
  };
}

export async function signInDemoUser(user: DemoUser) {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, encodeUser(user), {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
}

export async function signOutDemoUser() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
}

export async function getCurrentUser(): Promise<DemoUser | null> {
  const cookieStore = await cookies();
  return decodeUser(cookieStore.get(AUTH_COOKIE)?.value);
}

export async function requireUser(): Promise<DemoUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireAdmin(): Promise<DemoUser> {
  const user = await requireUser();
  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  return user;
}
