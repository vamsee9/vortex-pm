/**
 * supabase/middleware.ts
 * ---------------------
 * Session refresh + role-based routing guard.
 *
 * Phase 3 routing rules:
 * ─────────────────────
 * Owner  → /dashboard (org grid)
 * Admin  → /dashboard (project grid for their org)
 * Member → /board     (sprint board)
 *
 * Route guards prevent cross-role access.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // ── Public routes ──
  const isPublicRoute =
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/webhooks/");

  // Not logged in → login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // ── ESS Compliance: Force password change FIRST ──
  if (
    user &&
    user.user_metadata?.must_change_password === true &&
    pathname !== "/change-password"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/change-password";
    return NextResponse.redirect(url);
  }

  // ── Role detection ──
  const role = user?.user_metadata?.role || "member";

  // ── Logged-in user on /login → redirect to role-appropriate dashboard ──
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // ── Root redirect ──
  if (user && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // ── Role-based route guards ──
  if (user) {
    const url = request.nextUrl.clone();

    // Owner routes: /dashboard, /orgs, /orgs/[id]
    // Owners should NOT access /board, /projects, /settings, /admin directly
    if (role === "owner") {
      // Owner trying to access member/admin-specific pages
      if (
        pathname.startsWith("/board") ||
        pathname.startsWith("/projects") ||
        pathname.startsWith("/settings") ||
        pathname.startsWith("/admin")
      ) {
        // Allow if demo mode is active (checked via cookie)
        const isDemoMode = request.cookies.get("demo_mode");
        if (!isDemoMode) {
          url.pathname = "/dashboard";
          return NextResponse.redirect(url);
        }
      }
    }

    // Admin routes: /dashboard, /projects, /projects/*, /settings
    // Admins should NOT access /orgs (that's owner-level)
    if (role === "admin") {
      if (pathname.startsWith("/orgs")) {
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }

    // Member routes: /board, /reporting
    // Members should NOT access admin/owner pages
    if (role === "member") {
      if (
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/orgs") ||
        pathname.startsWith("/projects") ||
        pathname.startsWith("/admin") ||
        pathname.startsWith("/settings")
      ) {
        url.pathname = "/board";
        return NextResponse.redirect(url);
      }
    }

    // Project context guard for board/reporting (members & admins need active project)
    if (
      (pathname.startsWith("/board") || pathname.startsWith("/reporting")) &&
      role !== "owner"
    ) {
      const hasProject = request.cookies.get("active_project_id");
      if (!hasProject) {
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
