import { NextResponse, type NextRequest } from "next/server";

import { hasAuthCookie } from "@/lib/auth-cookie";

const protectedPrefixes = ["/dashboard"];
const authPages = ["/login", "/register", "/forgot-password"];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hasUser = hasAuthCookie(request);

  if (!hasUser && protectedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasUser && authPages.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"]
};
