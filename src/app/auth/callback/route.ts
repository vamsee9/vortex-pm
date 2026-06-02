/**
 * auth/callback/route.ts
 * ----------------------
 * Handles the auth callback after Supabase authentication.
 * When a user logs in, Supabase redirects here with an auth code.
 * We exchange that code for a session and redirect to the dashboard.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/board";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If something went wrong, send them back to login
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
