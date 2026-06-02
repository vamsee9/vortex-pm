/**
 * supabase/middleware.ts
 * ---------------------
 * Session refresh logic used by the Next.js middleware.
 * On every request, this refreshes the Supabase auth token
 * so the user stays logged in without issues.
 *
 * It also handles redirects:
 * - Not logged in? → Send to /login
 * - Logged in but on /login? → Send to /board
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // Start with a basic response that passes the request through
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // First update the request cookies (for downstream handlers)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          // Then create a fresh response with updated cookies
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session — this is the main job of this middleware
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public routes that don't need auth
  const isPublicRoute =
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/webhooks/");

  // If the user is NOT logged in and trying to access a protected page
  if (!user && !isPublicRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // If the user IS logged in and sitting on the login page, send them to /orgs
  if (user && pathname === "/login") {
    const orgsUrl = request.nextUrl.clone();
    orgsUrl.pathname = "/orgs";
    return NextResponse.redirect(orgsUrl);
  }

  // RBAC Guard: Protect Admin and Settings routes
  if (user && (pathname.startsWith("/admin") || pathname.startsWith("/settings"))) {
    const role = user.user_metadata?.role;
    if (role !== "admin" && role !== "moderator") {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = "/orgs";
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Project Context Guard: Block access to project routes if no project is active
  if (user && ["/board", "/qbr", "/settings", "/admin"].some(p => pathname.startsWith(p))) {
    const hasProject = request.cookies.get("active_project_id");
    if (!hasProject) {
      const orgsUrl = request.nextUrl.clone();
      orgsUrl.pathname = "/orgs";
      return NextResponse.redirect(orgsUrl);
    }
  }

  // ESS Compliance: Force password change on first login.
  // If the user's metadata says they must change their password,
  // redirect them to /change-password no matter what page they try to visit.
  // This is a hard block — not just a banner — to ensure compliance.
  if (
    user &&
    user.user_metadata?.must_change_password === true &&
    pathname !== "/change-password"
  ) {
    const changeUrl = request.nextUrl.clone();
    changeUrl.pathname = "/change-password";
    return NextResponse.redirect(changeUrl);
  }

  return supabaseResponse;
}
