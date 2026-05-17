import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function getSafeNextPath(value: string | null): string {
  if (!value?.startsWith("/")) {
    return "/dashboard";
  }

  if (value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"));

  if (code) {
    try {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
      }

      const loginUrl = new URL("/login", requestUrl.origin);
      loginUrl.searchParams.set("error", error.message);
      return NextResponse.redirect(loginUrl);
    } catch (error) {
      const loginUrl = new URL("/login", requestUrl.origin);
      loginUrl.searchParams.set(
        "error",
        error instanceof Error ? error.message : "Could not complete authentication."
      );
      return NextResponse.redirect(loginUrl);
    }
  }

  const loginUrl = new URL("/login", requestUrl.origin);
  loginUrl.searchParams.set(
    "error",
    requestUrl.searchParams.get("error_description") ?? "Could not complete authentication."
  );
  return NextResponse.redirect(loginUrl);
}
