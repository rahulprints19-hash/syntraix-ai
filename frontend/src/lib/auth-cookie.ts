export const AUTH_COOKIE = "syntrix_demo_user";

export function hasAuthCookie(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  return cookieHeader.split(";").some((cookie) => cookie.trim().startsWith(`${AUTH_COOKIE}=`));
}
