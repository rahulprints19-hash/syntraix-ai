import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const loginUrl = new URL("/login", requestUrl.origin);
  loginUrl.searchParams.set("error", "Google login was removed. Use email and password demo login.");

  return NextResponse.redirect(loginUrl);
}
