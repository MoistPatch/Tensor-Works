import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminRoute = pathname.startsWith("/admin") && !pathname.startsWith("/admin/auth");
  const isAdminApiRoute =
    pathname.startsWith("/api/admin") && !pathname.startsWith("/api/admin/auth");

  if (isAdminRoute || isAdminApiRoute) {
    const sessionToken = request.cookies.get("tw_admin_session")?.value;
    if (!sessionToken) {
      if (isAdminApiRoute) {
        return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/admin/auth/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
